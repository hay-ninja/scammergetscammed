"""CalHacks Federal's core banking lives in Capital One's Nessie API (loaded by scripts/seed_nessie.py).

The console's members, accounts and payments come from Nessie: `sync()` pulls them into
server/bank/data/nessie_snapshot.json, and every demo reset rebuilds the local ledger from that
snapshot, so resets stay instant and the demo survives a Nessie outage. The MargaretSGS Investigator
reads the same records live from Nessie.

Our controls write back where Nessie allows it: withdrawals and transfers can't be edited once created,
but accounts can, so a held or frozen CalHacks Federal mule account gets a `· HELD_REVIEW` / `· FROZEN`
flag on its Nessie account. Each reset clears those flags.
"""
import json
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path

import httpx

from server import config

BASE = "https://api.nessieisreal.com"  # plain http times out
SNAPSHOT = Path(__file__).parent / "data" / "nessie_snapshot.json"
FLAGGED = config.ROOT / "training" / "data" / "nessie_flagged.json"  # accounts we flagged, so reset can clear them
TAG = re.compile(r"member (\d+) · acct (\d+) · born (\d{4}) · since (\d{4})(?: · (\w+))?")
WIRE = re.compile(r"WIRE OUT (.+?) RTN (\d{9}) ACCT (\d+) · (.*)")
XFER = re.compile(r"TRANSFER TO member (\d+) acct (\d+) \((.*?)\) · (.*)")
_lock = threading.Lock()


def _client() -> httpx.Client:
    return httpx.Client(base_url=BASE, params={"key": config.NESSIE_API_KEY}, timeout=40)


def _list(c: httpx.Client, path: str) -> list:
    r = c.get(path)
    if r.status_code == 404:  # Nessie answers "No transfers found for this account" for an empty list
        return []
    r.raise_for_status()
    return r.json()


def sync(workers: int = 16) -> dict:
    """Pull every CalHacks Federal customer, account, withdrawal and transfer from Nessie into the snapshot."""
    with _client() as c:
        customers = {x["_id"]: x for x in _list(c, "/customers")}
        accounts = _list(c, "/accounts")

        def one(a):
            return a["_id"], _list(c, f"/accounts/{a['_id']}/withdrawals"), _list(c, f"/accounts/{a['_id']}/transfers")

        with ThreadPoolExecutor(workers) as pool:
            txns = {aid: {"withdrawals": w, "transfers": t} for aid, w, t in pool.map(one, accounts)}
    snap = {"synced_at": datetime.now().isoformat(timespec="seconds"), "source": BASE,
            "customers": customers, "accounts": accounts, "txns": txns}
    SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT.write_text(json.dumps(snap))
    return {"customers": len(customers), "accounts": len(accounts),
            "transactions": sum(len(v["withdrawals"]) + len(v["transfers"]) for v in txns.values())}


_info: dict = {}


def snapshot_info() -> dict | None:
    """Where the ledger came from, for the console (cached; the snapshot only changes on sync)."""
    if not SNAPSHOT.exists():
        return None
    mtime = SNAPSHOT.stat().st_mtime
    if _info.get("mtime") != mtime:
        snap = json.loads(SNAPSHOT.read_text())
        _info.update(mtime=mtime, value={"source": "Capital One Nessie", "api": BASE, "synced_at": snap["synced_at"],
                                         "accounts": len(snap["accounts"]), "customers": len(snap["customers"])})
    return _info["value"]


def load_into(conn, routing: str, bank_name: str, mule_labels: dict[str, str], opened_days: dict[str, int]) -> bool:
    """Rebuild customers, accounts and transfers from the snapshot. Returns False when there's no snapshot."""
    if not SNAPSHOT.exists():
        return False
    snap = json.loads(SNAPSHOT.read_text())
    now = datetime.now()
    cust_ids, acct_ids, numbers = {}, {}, {}
    for a in sorted(snap["accounts"], key=lambda a: (a["nickname"], a["type"])):
        m = TAG.search(a["nickname"] or "")
        if not m:
            continue
        member, acct, born, since, flag = m.groups()
        age = now.year - int(born)
        if member not in cust_ids:
            cu = snap["customers"].get(a["customer_id"], {})
            name = " ".join(x for x in (cu.get("first_name"), cu.get("last_name")) if x and x != "-") or f"Member {member}"
            if flag == "NEW":
                days = opened_days.get(acct, 60)
                risk, since_date = "new account", (now - timedelta(days=days)).date().isoformat()
            else:
                risk, since_date = ("decoy" if flag == "DECOY" else "elderly" if age >= 65 else ""), f"{since}-06-01"
            cust_ids[member] = conn.execute(
                "INSERT INTO customers (name, age, risk_flags, member_since) VALUES (?,?,?,?)",
                (name + (" (decoy)" if flag == "DECOY" else ""), age, risk, since_date)).lastrowid
        kind = a["type"] if a["type"] in ("Checking", "Savings") else "Checking"
        number = acct if kind == "Checking" else str(int(acct) + 1)
        acct_ids[a["_id"]] = conn.execute(
            "INSERT INTO accounts (customer_id, routing, number, bank_name, balance, kind, label, nessie_id, nessie_nickname) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (cust_ids[member], routing, number, bank_name, a.get("balance") or 0, kind, mule_labels.get(number, ""),
             a["_id"], a["nickname"])).lastrowid
        numbers[a["_id"]] = number

    def when(d: str, status: str) -> str:
        if status == "pending":  # in flight right now
            return (now - timedelta(minutes=20)).isoformat(timespec="seconds")
        return f"{d}T10:00:00"

    for aid, t in snap["txns"].items():
        if aid not in acct_ids:
            continue
        for w in t["withdrawals"]:
            m = WIRE.match(w.get("description", ""))
            to = (m.group(2), m.group(3), m.group(4)) if m else ("", "", w.get("description", ""))
            conn.execute("INSERT INTO transfers (from_account, to_routing, to_number, to_name, amount, status, created_at, nessie_id) "
                         "VALUES (?,?,?,?,?,?,?,?)", (acct_ids[aid], *to, w["amount"], w["status"], when(w["transaction_date"], w["status"]), w["_id"]))
        for x in t["transfers"]:
            m = XFER.match(x.get("description", ""))
            to = (routing, m.group(2), m.group(4)) if m else (routing, numbers[aid], x.get("description", ""))
            conn.execute("INSERT INTO transfers (from_account, to_routing, to_number, to_name, amount, status, created_at, nessie_id) "
                         "VALUES (?,?,?,?,?,?,?,?)", (acct_ids[aid], *to, x["amount"], x["status"], when(x["transaction_date"], x["status"]),
                                                     x.get("_id") or x.get("id")))
    return True


# ---- write-back: flags on Nessie accounts --------------------------------------

def _flagged() -> dict:
    return json.loads(FLAGGED.read_text()) if FLAGGED.exists() else {}


def _put_nickname(nessie_id: str, nickname: str) -> None:
    try:
        with _client() as c:
            c.put(f"/accounts/{nessie_id}", json={"nickname": nickname})
    except httpx.HTTPError:
        pass  # Nessie down: the local ledger is still right, and the next reset retries


def flag_account(nessie_id: str | None, original: str | None, flag: str) -> None:
    """Mark a CalHacks Federal account in Nessie (HELD_REVIEW or FROZEN), in the background."""
    if not (config.NESSIE_API_KEY and nessie_id and original):
        return
    with _lock:
        f = _flagged()
        f[nessie_id] = original
        FLAGGED.parent.mkdir(parents=True, exist_ok=True)
        FLAGGED.write_text(json.dumps(f))
    threading.Thread(target=_put_nickname, args=(nessie_id, f"{original} · {flag}"), daemon=True).start()


def clear_flags() -> None:
    """Put back the original nicknames of every account we flagged (runs in the background on reset)."""
    if not config.NESSIE_API_KEY:
        return
    with _lock:
        f = _flagged()
        if not f:
            return
        FLAGGED.write_text("{}")

    def run():
        for nid, nick in f.items():
            _put_nickname(nid, nick)
    threading.Thread(target=run, daemon=True).start()


if __name__ == "__main__":
    t0 = time.time()
    print(sync(), f"in {time.time() - t0:.0f}s ->", SNAPSHOT)
