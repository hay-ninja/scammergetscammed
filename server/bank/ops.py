"""Read models and analyst actions for the CalHacks Federal Fraud Ops console.

Cases, members, payments, blocklist and audit views come from SQLite. The live case also reads the
current call's session state, so the console shows the gate's evidence without changing MargaretSGS.
"""
import json
import re
from datetime import datetime, timedelta

from server import config
from server.bank import db, engine
from server.bank.seed import BANKS, BAY_FEDERAL
from server.scamwatch.classifier import PRESSURE_STAGES

ANALYST = "J. Rivera"
SEAT = "MargaretSGS seat"
STAGE_WORDS = {"authority": "claims authority", "fear_urgency": "fear & urgency", "secrecy": "demands secrecy",
               "remote_access": "remote access"}
GATE_LABELS = {"pressure_stages": f"{config.GATE_MIN_PRESSURE_STAGES}+ pressure tactic{'s' if config.GATE_MIN_PRESSURE_STAGES > 1 else ''}", "asked_for_safe_account_first": "“Safe account” asked first",
               "scam_score": f"Scam score ≥ {config.GATE_MIN_SCAM_SCORE}", "routing_checksum": "Routing checksum valid",
               "not_allowlisted": "Not on allowlist"}
# (pattern in a memo or caller line, who it claims to be, why that can't be true)
CLAIMS = [
    (r"federal reserve|\bfrb\b", "the Federal Reserve", "The Federal Reserve never holds accounts for consumers."),
    (r"treasury|\birs\b", "the US Treasury", "The Treasury and IRS never take payments into a “holding account” at a private bank."),
    (r"court|bail", "a court", "Courts don't take bail by wire into an account at a private bank."),
    (r"refund", "a tech-support refund", "Software companies don't collect refunds by wire transfer."),
    (r"secure|protected|safe", "a bank “safe account”", "Banks never ask members to move money into a “safe” or “secure” account."),
]


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _mask(number: str) -> str:
    return "••" + number[-4:]


def _rows(sql: str, args=()) -> list[dict]:
    conn = db.connect()
    out = [dict(r) for r in conn.execute(sql, args).fetchall()]
    conn.close()
    return out


def _case_keys() -> dict[str, str]:
    """call_id -> case key."""
    return {r["call_id"]: r["key"] for r in _rows("SELECT call_id, key FROM cases")}


def _blocked_index() -> dict[tuple, dict]:
    keys = _case_keys()
    return {(r["routing"], r["number"]): r | {"case": keys.get(r["source_call_id"])}
            for r in _rows("SELECT * FROM blocklist")}


# ---- live case ---------------------------------------------------------------

def _caller_text(state: dict) -> str:
    return " ".join(l["text"].lower() for l in state["transcript"] if l["speaker"] == "caller")


def typology(state: dict) -> str:
    t = _caller_text(state)
    if "federal reserve" in t:
        return "Phantom hacker · Federal Reserve impostor"
    if re.search(r"\birs\b|warrant", t):
        return "IRS impostor · arrest warrant"
    if "bail" in t:
        return "Grandparent bail · fake public defender"
    if "remote_access" in state["stages_seen"] or re.search(r"anydesk|microsoft|windows support", t):
        return "Tech support refund · Microsoft impostor"
    if "fraud department" in t:
        return "Bank impostor · fake CalHacks Federal fraud dept"
    if "title" in t and ("closing" in t or "escrow" in t):
        return "Escrow wire · title company"
    if state["call"]["status"] == "ended" and not any(a["status"] == "blocked" for a in state["accounts"]):
        return "Decoy call · no scam pattern"
    return "Decoy call · in progress"


def case_status(state: dict) -> str:
    imp = state["impact"]
    if imp.get("freeze_rejected"):
        return "Rejected"
    if imp.get("freeze_approved"):
        return "Confirmed"
    if any(a["status"] == "blocked" for a in state["accounts"]):
        return "Awaiting approval"
    return "No action" if state["call"]["status"] == "ended" else "New"


def open_case(call_id: str) -> str:
    conn = db.connect()
    n = conn.execute("SELECT COUNT(*) FROM cases").fetchone()[0]
    key = f"FRD-{1037 + n}"
    hist = [{"id": "open", "ts": _now(), "actor": "scamwatch", "action": "Case opened from decoy call", "note": f"Call {call_id}"}]
    conn.execute("INSERT INTO cases (call_id, key, summary, priority, status, assignee, created_at, status_since, protected, "
                 "history_json, intel_json, sar_markdown) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                 (call_id, key, "Decoy call · in progress", "Medium", "New", SEAT, _now(), _now(), 0, json.dumps(hist), "{}", ""))
    conn.commit()
    conn.close()
    return key


def _history_add(hist: list, id_: str, actor: str, action: str, note: str = "") -> bool:
    if any(h.get("id") == id_ for h in hist):
        return False
    hist.append({"id": id_, "ts": _now(), "actor": actor, "action": action, "note": note})
    return True


def sync_case(state: dict, decision: dict | None = None) -> None:
    """Bring the live call's case row in line with the session (idempotent, writes only on change)."""
    conn = db.connect()
    row = conn.execute("SELECT * FROM cases WHERE call_id=?", (state["call"]["id"],)).fetchone()
    if not row:
        conn.close()
        open_case(state["call"]["id"])
        conn = db.connect()
        row = conn.execute("SELECT * FROM cases WHERE call_id=?", (state["call"]["id"],)).fetchone()
    hist = json.loads(row["history_json"] or "[]")
    changed = False
    for a in state["accounts"]:
        if a["status"] == "blocked":
            r = a.get("result") or {}
            note = f"{len(r.get('holds', []))} wire held · {len(r.get('lookback', []))} recall requested"
            changed |= _history_add(hist, f"block:{a['routing']}/{a['number']}", "rules",
                                    f"Mule account blocked (provisional): {a['bank']} {_mask(a['number'])}", note)
    if decision:
        changed |= _history_add(hist, decision["id"], "analyst", decision["action"], decision.get("note", ""))
    status = case_status(state)
    if status != row["status"]:
        changed |= _history_add(hist, f"status:{status}", "analyst" if status in ("Confirmed", "Rejected") else "scamwatch",
                                f"Status → {status}")
    blocked = any(a["status"] == "blocked" for a in state["accounts"])
    vals = {"summary": typology(state), "priority": "Highest" if blocked else "Medium", "status": status,
            "assignee": ANALYST if status in ("Confirmed", "Rejected") else SEAT,
            "protected": state["impact"]["protected_total"], "intel_json": json.dumps(state["intel"]),
            "sar_markdown": state["sar"].get("markdown", "")}
    if changed or any(row[k] != v for k, v in vals.items()):
        if status != row["status"]:
            vals["status_since"] = _now()
        vals["history_json"] = json.dumps(hist)
        conn.execute(f"UPDATE cases SET {', '.join(f'{k}=?' for k in vals)} WHERE id=?", (*vals.values(), row["id"]))
        conn.commit()
    conn.close()


def _why(state: dict, acct: dict) -> list[dict]:
    pressure = [s for s in state["stages_seen"] if s in PRESSURE_STAGES]
    allow = engine.is_allowlisted(acct["routing"], acct["number"])
    data = {
        "pressure_stages": f"Heard {len(pressure)} of {config.GATE_MIN_PRESSURE_STAGES} needed: "
                           + (", ".join(STAGE_WORDS.get(s, s) for s in pressure) or "none"),
        "asked_for_safe_account_first": "Caller asked to move money to a protected/safe account before reading the number"
                                        if acct["after_ask"] else "The number was read out before any request to move money",
        "scam_score": f"Call score {state['scam_score']:.2f} vs threshold {config.GATE_MIN_SCAM_SCORE} ({state['model']})",
        "routing_checksum": f"ABA checksum on {acct['routing']} is {'valid' if acct['checksum_ok'] else 'invalid'}"
                            + (f" → {acct['bank']}" if acct["checksum_ok"] else ""),
        "not_allowlisted": f"On the allowlist as {allow}" if allow else "Not one of the bank's known-good payees",
    }
    return [{"check": k, "label": GATE_LABELS.get(k, k), "passed": bool(v), "data": data.get(k, "")}
            for k, v in acct["gate"].items()]


def _discrepancy(state: dict, acct: dict) -> dict | None:
    memos = _rows("SELECT t.to_name, t.amount, c.name FROM transfers t JOIN accounts a ON a.id=t.from_account "
                  "JOIN customers c ON c.id=a.customer_id WHERE t.to_routing=? AND t.to_number=? ORDER BY t.amount DESC",
                  (acct["routing"], acct["number"]))
    caller = next((l["text"] for l in state["transcript"] if l["speaker"] == "caller"
                   and re.search(r"(protected|safe|secure|holding|federal reserve|treasury|bail|court|backup)\b.*account|account\b.*(protected|safe|secure)",
                                 l["text"].lower())), None)
    claims = [{"source": f"Wire memo · {m['name']}, ${m['amount']:,.0f}", "says": m["to_name"]} for m in memos[:3]]
    if caller:
        claims.append({"source": "Caller, on the decoy call", "says": caller})
    hit = next(((who, rule) for c in claims for pat, who, rule in CLAIMS if re.search(pat, c["says"].lower())), None)
    if not hit:
        return None
    bank = acct["bank"]
    kind = "credit union" if "Credit Union" in bank else "bank"
    facts = [{"source": "ABA routing directory", "says": f"Routing {acct['routing']} resolves to {bank}, a private {kind}"}]
    owner = _rows("SELECT c.name, c.age, c.member_since FROM accounts a JOIN customers c ON c.id=a.customer_id "
                  "WHERE a.routing=? AND a.number=?", (acct["routing"], acct["number"]))
    if owner:
        o = owner[0]
        days = (datetime.now() - datetime.fromisoformat(o["member_since"])).days if o["member_since"] else None
        facts.append({"source": "CalHacks Federal core banking",
                      "says": f"{_mask(acct['number'])} belongs to {o['name']}, {o['age']}, a member for {days} days"})
    return {"claimed": hit[0], "claims": claims, "facts": facts, "rule": hit[1]}


def _live_detail(state: dict) -> dict:
    blocked_idx = _blocked_index()
    accounts = []
    for a in state["accounts"]:
        bl = blocked_idx.get((a["routing"], a["number"]))
        accounts.append({k: a[k] for k in ("routing", "number", "bank", "status", "checksum_ok", "gate")}
                        | {"result": a.get("result"), "why": _why(state, a), "blocklist": bl and bl["status"],
                           "discrepancy": _discrepancy(state, a) if a["status"] == "blocked" else None})
    failed = sorted({c["label"] for a in accounts if a["status"] != "blocked" for c in a["why"] if not c["passed"]})
    if not accounts:
        verdict = "No account number was read out on this call, so the gate never ran and nothing was blocked."
    elif all(a["status"] != "blocked" for a in accounts):
        verdict = (f"Nothing was blocked. The account was captured, but the gate needs every check to pass and "
                   f"these failed: {', '.join(failed)}.")
    else:
        verdict = "Blocked because every gate check passed. The talking AI has no tools; this decision came from the classifier, fixed rules and the bank's own data."
    return {"live": True, "call": state["call"], "intel": state["intel"], "stages_seen": state["stages_seen"],
            "scam_score": state["scam_score"], "model": state["model"], "accounts": accounts, "impact": state["impact"],
            "transcript": state["transcript"], "sar": state["sar"], "verdict": verdict}


# ---- read models -----------------------------------------------------------------

def cases(state: dict | None) -> list[dict]:
    if state:
        sync_case(state)
    out = _rows("SELECT key, call_id, summary, priority, status, assignee, created_at, status_since, protected FROM cases "
                "ORDER BY id DESC")
    live = state and state["call"]["id"]
    return [r | {"live": r["call_id"] == live} for r in out]


def case_detail(key: str, state: dict | None) -> dict | None:
    if state:
        sync_case(state)
    rows = _rows("SELECT * FROM cases WHERE key=?", (key,))
    if not rows:
        return None
    r = rows[0]
    out = {k: r[k] for k in ("key", "call_id", "summary", "priority", "status", "assignee", "created_at", "status_since", "protected")}
    out["history"] = json.loads(r["history_json"] or "[]")
    out["blocklist"] = [b | {"bank": engine.bank_name(b["routing"])}
                        for b in _rows("SELECT routing, number, status, created_at FROM blocklist WHERE source_call_id=?", (r["call_id"],))]
    if state and state["call"]["id"] == r["call_id"]:
        out |= _live_detail(state)
    else:
        out |= {"live": False, "sar": {"status": "ready" if r["sar_markdown"] else "none", "markdown": r["sar_markdown"] or ""}}
    return out


def _watch_status(accts: list[dict], transfers: list[dict]) -> str:
    st = {a["status"] for a in accts}
    ts = {t["status"] for t in transfers}
    if "frozen" in st:
        return "FROZEN"
    if "held_review" in st:
        return "BLOCKED"
    if "held" in ts:
        return "HELD"
    if "recall_requested" in ts:
        return "RECALL REQUESTED"
    if any(t["status"] == "pending" and t["amount"] >= 1000 for t in transfers):
        return "PENDING REVIEW"
    return "ACTIVE"


def members() -> list[dict]:
    custs = _rows("SELECT * FROM customers ORDER BY id")
    accts = _rows("SELECT * FROM accounts")
    trans = _rows("SELECT t.*, a.customer_id FROM transfers t JOIN accounts a ON a.id=t.from_account")
    blocked = _blocked_index()
    out = []
    for c in custs:
        mine = [a for a in accts if a["customer_id"] == c["id"]]
        tx = [t for t in trans if t["customer_id"] == c["id"]]
        cases_ = sorted({blocked[(t["to_routing"], t["to_number"])]["case"] for t in tx if (t["to_routing"], t["to_number"]) in blocked}
                        | {blocked[(a["routing"], a["number"])]["case"] for a in mine if (a["routing"], a["number"]) in blocked} - {None})
        flags = [f for f in (c["risk_flags"] or "").split(",") if f]
        if c["age"] >= 75 and not flags:
            flags.append("elderly")
        if any(a["label"] == "suspected mule" for a in mine):
            flags.append("suspected mule")
        out.append({
            "id": c["id"], "member_id": f"BF-{100200 + c['id']}", "name": c["name"], "age": c["age"],
            "member_since": c["member_since"], "accounts": [f"{a['kind'][:3].upper()} {_mask(a['number'])}" for a in mine],
            "balance": round(sum(a["balance"] or 0 for a in mine), 2),
            "last_activity": max([t["created_at"] for t in tx if t["created_at"] <= _now()] or [c["member_since"] or ""]),
            "risk_flags": flags, "watch": _watch_status(mine, tx), "cases": cases_,
        })
    return out


def member_detail(cid: int) -> dict | None:
    m = next((x for x in members() if x["id"] == cid), None)
    if not m:
        return None
    blocked = _blocked_index()
    m["account_list"] = [{"kind": a["kind"], "number": _mask(a["number"]), "balance": a["balance"], "status": a["status"],
                          "label": a["label"]} for a in _rows("SELECT * FROM accounts WHERE customer_id=?", (cid,))]
    m["transfers"] = [{"id": t["id"], "amount": t["amount"], "status": t["status"], "memo": t["to_name"], "created_at": t["created_at"],
                       "to": f"{engine.bank_name(t['to_routing'])} {_mask(t['to_number'])}",
                       "case": (blocked.get((t["to_routing"], t["to_number"])) or {}).get("case")}
                      for t in _rows("SELECT t.* FROM transfers t JOIN accounts a ON a.id=t.from_account WHERE a.customer_id=? "
                                     "ORDER BY t.created_at DESC", (cid,))]
    return m


def payments() -> list[dict]:
    blocked = _blocked_index()
    rows = _rows("SELECT t.*, c.id AS cid, c.name, c.age FROM transfers t JOIN accounts a ON a.id=t.from_account "
                 "JOIN customers c ON c.id=a.customer_id ORDER BY t.created_at DESC LIMIT 600")  # Nessie ledger: ~4k rows
    return [{"id": r["id"], "member": r["name"], "member_id": r["cid"], "age": r["age"], "amount": r["amount"], "status": r["status"],
             "memo": r["to_name"], "created_at": r["created_at"], "to": f"{engine.bank_name(r['to_routing'])} {_mask(r['to_number'])}",
             "case": (blocked.get((r["to_routing"], r["to_number"])) or {}).get("case")} for r in rows]


def blocklist() -> list[dict]:
    keys = _case_keys()
    out = []
    for b in _rows("SELECT * FROM blocklist ORDER BY created_at DESC"):
        hits = _rows("SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM transfers WHERE to_routing=? AND to_number=?",
                     (b["routing"], b["number"]))[0]
        out.append({"routing": b["routing"], "number": b["number"], "bank": engine.bank_name(b["routing"]),
                    "internal": b["routing"] == BAY_FEDERAL, "status": b["status"], "created_at": b["created_at"],
                    "case": keys.get(b["source_call_id"]), "hits": hits["n"], "hit_amount": hits["s"]})
    return out


def audit_log(limit: int = 300) -> list[dict]:
    return [{"ts": r["ts"], "actor": r["actor"], "action": r["action"], "details": json.loads(r["details_json"] or "{}")}
            for r in _rows("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,))]


def overview(state: dict | None) -> dict:
    cs = cases(state)
    bl = blocklist()
    prot = _rows("SELECT COALESCE(SUM(amount),0) s FROM transfers WHERE status IN ('held','recall_requested')")[0]["s"]
    by = {}
    for c in cs:
        by[c["status"]] = by.get(c["status"], 0) + 1
    return {"protected": prot, "this_call": state["impact"]["protected_total"] if state else 0,
            "blocked": {"provisional": sum(b["status"] == "provisional" for b in bl), "confirmed": sum(b["status"] == "confirmed" for b in bl)},
            "cases_by_status": by, "live_case": next((c for c in cs if c["live"]), None), "activity": audit_log(14)}


# ---- analyst actions -------------------------------------------------------------

def reject_freeze(reason: str) -> list[dict]:
    """The analyst says no: blocks stay provisional and holds stay on until someone releases them."""
    prov = _rows("SELECT routing, number FROM blocklist WHERE status='provisional'")
    engine.audit("analyst", "freeze_rejected", {"analyst": ANALYST, "reason": reason, "provisional_kept": prov,
                                                "note": "Holds stay in place until released by an analyst"})
    return prov


def release_hold(transfer_id: int) -> dict | None:
    conn = db.connect()
    cur = conn.execute("UPDATE transfers SET status='released' WHERE id=? AND status='held'", (transfer_id,))
    conn.commit()
    conn.close()
    if not cur.rowcount:
        return None
    return engine.audit("analyst", "hold_released", {"analyst": ANALYST, "transfer_id": transfer_id})


def simulate_new_wire(state: dict | None) -> dict | None:
    """Next week, a different member tries to wire the same mule. Payment screening holds it on the spot."""
    live = state and state["call"]["id"]
    entries = _rows("SELECT * FROM blocklist WHERE source_call_id=? ORDER BY routing<>? , id", (live, BAY_FEDERAL)) if live else []
    entries = entries or _rows("SELECT * FROM blocklist ORDER BY id DESC")
    if not entries:
        return None
    b = entries[0]
    used = {r["customer_id"] for r in _rows("SELECT a.customer_id FROM transfers t JOIN accounts a ON a.id=t.from_account "
                                            "WHERE t.to_routing=? AND t.to_number=?", (b["routing"], b["number"]))}
    member = next((c for c in _rows("SELECT c.id, c.name, c.age, a.id aid FROM customers c JOIN accounts a ON a.customer_id=c.id "
                                    "WHERE c.risk_flags IN ('', 'elderly') AND c.age>=68 AND a.kind='Checking' ORDER BY c.age DESC")
                   if c["id"] not in used), None)
    if not member:
        return None
    key = _case_keys().get(b["source_call_id"], "an earlier case")
    when = (datetime.now() + timedelta(days=7)).isoformat(timespec="seconds")
    amount = 11750.0
    memo = "Federal Reserve Protected Acct" if b["routing"] == BAY_FEDERAL else "Secure Holding Acct"
    conn = db.connect()
    tid = conn.execute("INSERT INTO transfers (from_account, to_routing, to_number, to_name, amount, status, created_at) "
                       "VALUES (?,?,?,?,?,?,?)", (member["aid"], b["routing"], b["number"], memo, amount, "held", when)).lastrowid
    conn.commit()
    conn.close()
    note = f"matched blocklist entry from case {key} (created {b['created_at'][:10]})"
    return engine.audit("rules", "transfer_held", {"transfer_id": tid, "customer": member["name"], "age": member["age"],
                                                   "amount": amount, "memo": memo, "simulated_date": when[:10],
                                                   "to": f"{engine.bank_name(b['routing'])} {_mask(b['number'])}", "reason": note})
