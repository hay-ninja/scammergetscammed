"""Load CalHacks Federal's core banking ledger into Capital One's Nessie API.

~300 members, ~90 days of activity (payroll, Social Security, pensions, bills, card purchases, ATM,
member-to-member transfers), the demo's known mule accounts and their victims, a hidden mule ring
that only a full-ledger investigation finds, members at risk right now, and legitimate lookalikes.

Usage:  .venv/Scripts/python scripts/seed_nessie.py            # wipe our accounts and reload
        .venv/Scripts/python scripts/seed_nessie.py --small    # quick test (~40 members)
Needs NESSIE_API_KEY in .env. Writes training/data/nessie_map.json (ids + the answer key for grading).

Nessie quirks this works around (tested Oct 2026): plain http times out, so https only; customers
can't be deleted, so they're reused by name; transfers have no payee field, so the payee goes in the
description and a matching deposit is written on the receiving account; enterprise endpoints return
every team's data, so the agent reads customer endpoints, which only see ours.
"""
import argparse
import json
import os
import random
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")
from server.bank.seed import (BANKS, BAY_FEDERAL, HIDDEN_1, HIDDEN_2, HIDDEN_INTERNAL, MULE_1, MULE_2,  # noqa: E402
                              MULE_BANK_IMPOSTOR, MULE_GRANDPARENT, MULE_IRS, MULE_TECH_SUPPORT)

BASE = "https://api.nessieisreal.com"
OUT = ROOT / "training" / "data" / "nessie_map.json"
TODAY = date.today()
FIRST = ["James", "Maria", "Robert", "Linda", "Michael", "Susan", "David", "Karen", "Wei", "Priya", "Carlos", "Aisha",
         "Thomas", "Nancy", "Kevin", "Grace", "Daniel", "Helen", "Jose", "Emily", "Hiro", "Fatima", "Omar", "Rosa",
         "Samuel", "Irene", "Victor", "Joan", "Andre", "Lucy", "Mei", "Raj", "Diane", "Frank", "Gloria", "Paul"]
LAST = ["Nguyen", "Garcia", "Smith", "Chen", "Johnson", "Patel", "Lopez", "Kim", "Brown", "Wong", "Davis", "Martinez",
        "Lee", "Miller", "Singh", "Okafor", "Rossi", "Cohen", "Haddad", "Silva", "Tran", "Murphy", "Ito", "Reyes"]
MERCHANTS = [("Safeway", "Groceries"), ("Trader Joe's", "Groceries"), ("Walgreens", "Pharmacy"), ("CVS Pharmacy", "Pharmacy"),
             ("Shell", "Gas"), ("Chevron", "Gas"), ("Target", "Retail"), ("Amazon", "Retail"), ("Peet's Coffee", "Dining"),
             ("Chipotle", "Dining"), ("Ace Hardware", "Home"), ("BART", "Transit")]
BILLS = [("PG&E Utilities", 90, 320), ("Comcast Xfinity", 60, 140), ("Golden State Insurance", 110, 380),
         ("AT&T Wireless", 45, 120), ("EBMUD Water", 40, 110)]
HOUSING = [("Bayview Apartments Rent", 1700, 3400), ("Pacific Mortgage", 1900, 4200)]


def d(days_ago: float) -> str:
    return (TODAY - timedelta(days=int(days_ago))).isoformat()


class Nessie:
    def __init__(self, key: str):
        self.c = httpx.Client(base_url=BASE, params={"key": key}, timeout=40,
                              limits=httpx.Limits(max_connections=32, max_keepalive_connections=32))
        self.n = 0
        self.lock = threading.Lock()

    def req(self, method: str, path: str, body: dict | None = None):
        for attempt in range(5):
            try:
                r = self.c.request(method, path, json=body)
                if r.status_code < 500 and r.status_code != 429:
                    if r.status_code >= 400:
                        raise RuntimeError(f"{method} {path} -> {r.status_code} {r.text[:200]}")
                    with self.lock:
                        self.n += 1
                    return r.json() if r.text else None
            except httpx.HTTPError:
                pass
            time.sleep(1.5 * 2 ** attempt)
        raise RuntimeError(f"{method} {path} failed after retries")

    def created(self, path: str, body: dict) -> str:
        return self.req("POST", path, body)["objectCreated"]["_id"]


def build(rng: random.Random, n_background: int) -> tuple[list[dict], dict]:
    """The whole ledger as plain data first, so the story is easy to read and grade."""
    members, key = [], {"known_mules": [], "hidden_mules": [], "victims": [], "at_risk": [], "lookalikes": []}
    next_id = [10001]

    def member(name, age, since_days=None, flags="", savings=None, acct=None):
        m = {"member_id": next_id[0], "name": name, "age": age, "flags": flags, "txns": [],
             "since": (TODAY - timedelta(days=since_days if since_days is not None else rng.randint(400, 365 * max(2, min(40, age - 19))))).year,
             "acct": acct or str(rng.randint(10**7, 10**8 - 1)), "balance": round(rng.uniform(900, 14000), 2),
             "savings": savings if savings is not None else (round(rng.uniform(18000, 240000), 2) if age >= 60 else None)}
        next_id[0] += 1
        members.append(m)
        return m

    def txn(m, kind, amount, days_ago, desc, status="completed", account="checking", merchant=None):
        m["txns"].append({"kind": kind, "amount": round(amount, 2), "date": d(days_ago), "status": status,
                          "desc": desc, "account": account, "merchant": merchant})

    def wire(m, mule, memo, amount, days_ago, status="completed"):
        txn(m, "withdrawal", amount, days_ago, f"WIRE OUT {BANKS[mule['routing']]} RTN {mule['routing']} ACCT {mule['number']} · {memo}", status)

    def internal(m, to, memo, amount, days_ago, status="completed"):
        txn(m, "transfer", amount, days_ago, f"TRANSFER TO member {to['member_id']} acct {to['acct']} ({to['name']}) · {memo}", status)
        txn(to, "deposit", amount, days_ago, f"TRANSFER FROM member {m['member_id']} acct {m['acct']} ({m['name']}) · {memo}", status)

    def routine(m):
        """90 days of ordinary life for one member."""
        if m["age"] >= 63:
            for k in range(3):
                txn(m, "deposit", rng.choice([1480, 1720, 1960, 2240, 2610]), 3 + 30 * k, "SSA TREAS 310 SOC SEC")
            if rng.random() < 0.45:
                for k in range(3):
                    txn(m, "deposit", rng.choice([850, 1200, 1650, 2300]), 1 + 30 * k, "PENSION CALPERS")
        else:
            pay = rng.choice([1850, 2400, 2950, 3600, 4800])
            for k in range(6):
                txn(m, "deposit", pay, 2 + 15 * k, f"PAYROLL {rng.choice(['UC BERKELEY', 'KAISER', 'BART', 'SAFEWAY INC', 'CITY OF OAKLAND'])}")
        for name, lo, hi in rng.sample(BILLS, 3):
            for k in range(3):
                txn(m, "withdrawal", rng.uniform(lo, hi), 5 + 30 * k + rng.randint(0, 3), f"BILLPAY {name}")
        if m["age"] < 75 or rng.random() < 0.4:
            name, lo, hi = rng.choice(HOUSING)
            amt = rng.uniform(lo, hi)
            for k in range(3):
                txn(m, "withdrawal", amt, 1 + 30 * k, f"BILLPAY {name}")
        for _ in range(rng.randint(10, 26)):
            merch = rng.choice(MERCHANTS)
            txn(m, "purchase", rng.uniform(4, 160), rng.uniform(0, 89), f"POS {merch[0]}", merchant=merch[0])
        for _ in range(rng.randint(0, 3)):
            txn(m, "withdrawal", rng.choice([40, 60, 100, 200]), rng.uniform(0, 89), "ATM WITHDRAWAL")
        if rng.random() < 0.15:
            txn(m, "withdrawal", rng.choice([25, 50, 100, 250]), rng.uniform(0, 89), f"DONATION {rng.choice(['American Red Cross', 'SF-Marin Food Bank', 'KQED'])}")

    # The decoy line: no money, flagged so the agent ignores it.
    member("Margaret Wilson", 78, since_days=60, flags="DECOY", savings=None)["balance"] = 0

    # Mule accounts at our bank. Owners are new, young members; money comes in from elderly members and goes right out.
    alvarez = member("R. Alvarez", 24, since_days=74, flags="NEW", savings=None, acct=MULE_1["number"])
    brandt = member("T. Brandt", 24, since_days=41, flags="NEW", savings=None, acct=MULE_IRS["number"])
    okoro = member("D. Okoro", 22, since_days=23, flags="NEW", savings=None, acct=HIDDEN_INTERNAL["number"])  # hidden
    for mm in (alvarez, brandt, okoro):
        mm["balance"] = round(rng.uniform(300, 2500), 2)

    # Hidden outside mule accounts, linked to the known ring by memo wording and by money flowing between them.
    H1, H2 = HIDDEN_1, HIDDEN_2

    known = []
    # The demo story (matches server/bank/seed.py, so the call's holds and the ledger agree).
    dorothy = member("Dorothy Park", 81); wire(dorothy, MULE_1, "Federal Reserve Protected Acct", 8500, 0, "pending")
    harold = member("Harold Jenkins", 79); internal(harold, alvarez, "FRB Asset Protection", 26000, 9)
    june = member("June Okafor", 83); wire(june, MULE_2, "US Treasury Safe Account", 15000, 4)
    known += [(dorothy, MULE_1, 8500, 0, "pending"), (harold, MULE_1, 26000, 9, "completed"), (june, MULE_2, 15000, 4, "completed")]
    for mule, memo, victims in [
        (MULE_BANK_IMPOSTOR, "Secure Holding Acct", [("Evelyn Brooks", 77, 12400, 0, "pending"), ("Frank Morales", 84, 31000, 6, "completed")]),
        (MULE_TECH_SUPPORT, "Refund Reversal", [("Ruth Adler", 80, 4900, 0, "pending"), ("George Tanaka", 76, 9800, 12, "completed")]),
        (MULE_GRANDPARENT, "Court Bail Services", [("Betty Coleman", 82, 7500, 0, "pending")]),
    ]:
        for name, age, amt, days, status in victims:
            v = member(name, age); wire(v, mule, memo, amt, days, status); known.append((v, mule, amt, days, status))
    for name, age, amt, days, status in [("Agnes Liu", 79, 6000, 0, "pending"), ("Walter Hughes", 85, 18250, 3, "completed")]:
        v = member(name, age); internal(v, brandt, "Treasury Holding Acct", amt, days, status); known.append((v, MULE_IRS, amt, days, status))

    # Money out of the known internal mule goes to H1: the thread that leads to the hidden ring.
    txn(alvarez, "withdrawal", 24000, 8, f"WIRE OUT {BANKS[H1['routing']]} RTN {H1['routing']} ACCT {H1['number']} · consulting services")
    txn(brandt, "withdrawal", 17500, 2, f"WIRE OUT {BANKS[H2['routing']]} RTN {H2['routing']} ACCT {H2['number']} · invoice 2291")

    hidden_victims = []
    for name, age, amt, days, memo, status in [("Lillian Ford", 80, 9400, 18, "Federal Reserve Protected Acct", "completed"),
                                               ("Raymond Cole", 78, 9900, 12, "FRB secure holding", "completed"),
                                               ("Mildred Shaw", 84, 7800, 6, "protected account", "completed")]:
        v = member(name, age)
        txn(v, "transfer", 20000, days + 1, "TRANSFER savings to checking", account="savings")
        internal(v, okoro, memo, amt, days, status)
        txn(okoro, "withdrawal", amt - 200, days - 1 if days > 1 else 0,
            f"WIRE OUT {BANKS[H1['routing']]} RTN {H1['routing']} ACCT {H1['number']} · consulting services")
        hidden_victims.append((v, {"routing": BAY_FEDERAL, "number": okoro["acct"]}, amt, days, status))
    for name, age, amt, days, memo, status, mule in [("Eleanor Vance", 82, 14000, 27, "Federal Reserve Protected Acct", "completed", H1),
                                                     ("Arthur Price", 81, 12000, 15, "US Treasury Safe Account", "completed", H2)]:
        v = member(name, age); wire(v, mule, memo, amt, days, status); hidden_victims.append((v, mule, amt, days, status))

    # At risk right now: a wire to a hidden mule is still pending, or a gift-card run.
    clara = member("Clara Bennett", 79)
    txn(clara, "transfer", 30000, 0, "TRANSFER savings to checking", account="savings")
    wire(clara, H1, "Fed protected account", 9500, 0, "pending")
    nora = member("Nora Diaz", 77)
    txn(nora, "transfer", 25000, 1, "TRANSFER savings to checking", account="savings")
    wire(nora, H2, "US Treasury Safe Account", 9000, 0, "pending")
    samuel = member("Samuel Ortiz", 83)
    for k, amt in enumerate([1500, 1500, 1000]):
        txn(samuel, "purchase", amt, k % 2, "POS Target GIFT CARDS", merchant="Target")

    # Legitimate lookalikes the agent must clear.
    patricia = member("Patricia Hall", 67, savings=320000)
    txn(patricia, "transfer", 190000, 3, "TRANSFER savings to checking", account="savings")
    txn(patricia, "withdrawal", 185000, 2, "WIRE OUT Golden Gate Community Bank RTN 567340122 ACCT 30451877 · Golden Gate Title escrow, closing 1421 Elm St")
    jamie = member("Jamie Wu", 34)
    george_wu = member("George Wu", 72)
    for k in range(3):
        internal(george_wu, jamie, "rent help - Jamie", 1200, 2 + 30 * k)
    linda = member("Linda Park", 61)
    txn(linda, "withdrawal", 9000, 7, "WIRE OUT Coastal Harbor Bank RTN 551204711 ACCT 70883215 · to my own Coastal Harbor savings (Linda Park)")
    teresa = member("Teresa Gomez", 74)
    txn(teresa, "withdrawal", 9800, 10, "WIRE OUT Pinecrest Savings RTN 558903361 ACCT 41129073 · Sutter Health surgery deposit, invoice SH-88412")

    for m in [m for m in members if m["flags"] != "DECOY"]:
        if m["flags"] != "NEW":
            routine(m)
    for _ in range(n_background):
        routine(member(f"{rng.choice(FIRST)} {rng.choice(LAST)}", rng.choice([rng.randint(22, 59), rng.randint(60, 92)])))

    def v_entry(m, mule, amt, days, status):
        return {"member_id": m["member_id"], "name": m["name"], "age": m["age"], "amount": amt, "date": d(days),
                "status": status, "to": f"{mule['routing']}/{mule['number']}"}
    key["known_mules"] = [f"{x['routing']}/{x['number']}" for x in (MULE_1, MULE_2, MULE_BANK_IMPOSTOR, MULE_TECH_SUPPORT, MULE_GRANDPARENT, MULE_IRS)]
    key["hidden_mules"] = [{"account": f"{H1['routing']}/{H1['number']}", "why": "receives the money wired out of known mule R. Alvarez and the hidden mule D. Okoro; same memos"},
                           {"account": f"{H2['routing']}/{H2['number']}", "why": "receives from known mule T. Brandt; 'US Treasury Safe Account' memo, same as June Okafor's"},
                           {"account": f"{BAY_FEDERAL}/{okoro['acct']}", "why": "CalHacks Federal account opened 23 days ago; three elderly members paid it, each passed straight to H1"}]
    key["victims"] = [v_entry(*x) for x in known + hidden_victims]
    key["hidden_victims"] = [v_entry(*x) for x in hidden_victims]
    key["at_risk"] = [{"member_id": m["member_id"], "name": m["name"], "why": w} for m, w in [
        (clara, "pending $9,500 wire to hidden mule H1 after a $30,000 savings move"),
        (nora, "pending $9,000 wire to hidden mule H2 after a $25,000 savings move"),
        (samuel, "$4,000 of Target gift cards in two days")]]
    key["lookalikes"] = [{"member_id": m["member_id"], "name": m["name"], "why": w} for m, w in [
        (patricia, "escrow wire for a home closing"), (george_wu, "monthly rent help to his son, a member"),
        (linda, "wire to her own account at another bank"), (teresa, "hospital surgery deposit with an invoice")]]
    return members, key


def upload(api: Nessie, members: list[dict], workers: int) -> dict:
    existing = {(c["first_name"], c["last_name"]): c["_id"] for c in api.req("GET", "/customers")}
    for a in api.req("GET", "/accounts"):
        api.req("DELETE", f"/accounts/{a['_id']}")
    merchants = {m["name"]: m["_id"] for m in api.req("GET", "/merchants")}
    for name, cat in MERCHANTS:
        if name not in merchants:
            merchants[name] = api.created("/merchants", {"name": name, "category": cat, "address": {
                "street_number": "100", "street_name": "Shattuck Ave", "city": "Berkeley", "state": "CA", "zip": "94704"},
                "geocode": {"lat": 37.87, "lng": -122.27}})

    def one(m):
        first, _, last = m["name"].partition(" ")
        cid = existing.get((first, last or "-")) or api.created("/customers", {"first_name": first, "last_name": last or "-", "address": {
            "street_number": str(100 + m["member_id"] % 900), "street_name": "Oak St", "city": "Berkeley", "state": "CA", "zip": "94704"}})
        tag = f"member {m['member_id']} · acct {m['acct']} · born {TODAY.year - m['age']} · since {m['since']}" + (f" · {m['flags']}" if m["flags"] else "")
        ids = {"customer_id": cid, "checking": api.created(f"/customers/{cid}/accounts", {
            "type": "Checking", "nickname": f"Checking · {tag}", "rewards": 0, "balance": int(m["balance"])})}
        if m["savings"]:
            ids["savings"] = api.created(f"/customers/{cid}/accounts", {
                "type": "Savings", "nickname": f"Savings · {tag}", "rewards": 0, "balance": int(m["savings"])})
        for t in m["txns"]:
            acct = ids.get(t["account"], ids["checking"])
            base = {"amount": t["amount"], "status": t["status"], "description": t["desc"]}
            if t["kind"] == "purchase":
                api.req("POST", f"/accounts/{acct}/purchases", {**base, "merchant_id": merchants[t["merchant"]], "medium": "balance", "purchase_date": t["date"]})
            elif t["kind"] == "transfer":
                api.req("POST", f"/accounts/{acct}/transfers", {**base, "transaction_date": t["date"]})
            else:
                api.req("POST", f"/accounts/{acct}/{t['kind']}s", {**base, "medium": "balance", "transaction_date": t["date"]})
        return m["member_id"], ids

    t0 = time.time()
    out = {}
    with ThreadPoolExecutor(workers) as pool:
        for i, (mid, ids) in enumerate(pool.map(one, members), 1):
            out[mid] = ids
            if i % 25 == 0:
                print(f"  {i}/{len(members)} members · {api.n} requests · {api.n / (time.time() - t0):.0f}/s", flush=True)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--small", action="store_true", help="~40 members, for a quick test")
    ap.add_argument("--workers", type=int, default=12)
    args = ap.parse_args()
    members, key = build(random.Random(7), 15 if args.small else 270)
    n_txn = sum(len(m["txns"]) for m in members)
    print(f"{len(members)} members, {n_txn} transactions -> Nessie", flush=True)
    api = Nessie(os.environ["NESSIE_API_KEY"])
    ids = upload(api, members, args.workers)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"loaded": TODAY.isoformat(), "members": [
        {"member_id": m["member_id"], "name": m["name"], "age": m["age"], "acct": m["acct"], "flags": m["flags"], **ids[m["member_id"]]}
        for m in members], "answer_key": key}, indent=1))
    print(f"done: {len(members)} members, {n_txn} transactions, {api.n} requests. Map + answer key: {OUT}")


if __name__ == "__main__":
    main()
