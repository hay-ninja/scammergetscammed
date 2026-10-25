"""Seed the fictional CalHacks Federal Credit Union with the demo story.

Routing numbers all start with 5x. That prefix isn't assigned to any real
US bank, so none of these can collide with a real routing number.
"""
import json
import random
from datetime import datetime, timedelta

from server.bank import db

BAY_FEDERAL = "572109086"
BANKS = {
    BAY_FEDERAL: "CalHacks Federal Credit Union",
    "551204711": "Coastal Harbor Bank",
    "558903361": "Pinecrest Savings",
    "567340122": "Golden Gate Community Bank",
}

# The two "safe accounts" on the judge's script card.
MULE_1 = {"routing": BAY_FEDERAL, "number": "44102287"}  # held at our bank
MULE_2 = {"routing": "551204711", "number": "77305196"}  # held at another bank
# One "safe account" per extra judge script (demo/scripts), each with its own victims.
MULE_BANK_IMPOSTOR = {"routing": "558903361", "number": "63018842"}
MULE_TECH_SUPPORT = {"routing": "567340122", "number": "90217735"}
MULE_GRANDPARENT = {"routing": "551204711", "number": "58830419"}
MULE_IRS = {"routing": BAY_FEDERAL, "number": "31907742"}  # at our bank, so the freeze flow shows
# The hidden ring only the CREAO investigator finds (scripts/seed_nessie.py has the same story in Nessie).
HIDDEN_1 = {"routing": "558903361", "number": "92650318"}
HIDDEN_2 = {"routing": "567340122", "number": "66019284"}
HIDDEN_INTERNAL = {"routing": BAY_FEDERAL, "number": "52871904"}

FIRST = ["James", "Maria", "Robert", "Linda", "Michael", "Susan", "David", "Karen",
         "Wei", "Priya", "Carlos", "Aisha", "Thomas", "Nancy", "Kevin", "Grace",
         "Daniel", "Helen", "Jose", "Emily"]
LAST = ["Nguyen", "Garcia", "Smith", "Chen", "Johnson", "Patel", "Lopez", "Kim",
        "Brown", "Wong", "Davis", "Martinez", "Lee", "Miller", "Singh"]
# (key, days ago, summary, status, assignee, protected, mule account or None)
HISTORY = [
    ("FRD-1037", 19, "IRS impostor · arrest warrant", "Confirmed", "M. Chen", 22400, ("558903361", "40517733")),
    ("FRD-1038", 14, "Grandparent bail · fake public defender", "Confirmed", "J. Rivera", 9000, ("567340122", "71820046")),
    ("FRD-1039", 9, "Escrow wire · title company (legitimate)", "Rejected", "J. Rivera", 0, None),
    ("FRD-1040", 5, "Tech support refund · Microsoft impostor", "Confirmed", "M. Chen", 6200, ("558903361", "83391507")),
    ("FRD-1041", 2, "Bank impostor · fake CalHacks Federal fraud dept", "Confirmed", "J. Rivera", 12000, ("567340122", "15562290")),
]
PAYEES = [("PG&E Utilities", 180, 420), ("Bayview Apartments Rent", 1800, 3200),
          ("Safeway", 60, 240), ("Kaiser Permanente", 40, 400),
          ("Comcast", 70, 140), ("Golden State Insurance", 120, 380)]


def _ts(days_ago: float) -> str:
    return (datetime.now() - timedelta(days=days_ago)).isoformat(timespec="seconds")


def _synthetic_ledger(conn, rng, meta) -> None:
    """The original generated ledger (~60 members), used only when there's no Nessie snapshot."""
    def customer(name, age, flags=""):
        since = (datetime.now() - timedelta(days=meta.randint(400, 365 * min(40, max(2, age - 20))))).date().isoformat()
        cid = conn.execute("INSERT INTO customers (name, age, risk_flags, member_since) VALUES (?,?,?,?)",
                           (name, age, flags, since)).lastrowid
        num = str(rng.randint(10_000_000, 99_999_999))
        aid = conn.execute(
            "INSERT INTO accounts (customer_id, routing, number, bank_name, balance) VALUES (?,?,?,?,?)",
            (cid, BAY_FEDERAL, num, BANKS[BAY_FEDERAL], 0 if flags == "decoy" else round(meta.uniform(900, 14000), 2))).lastrowid
        if age >= 60 and flags != "decoy":
            conn.execute("INSERT INTO accounts (customer_id, routing, number, bank_name, balance, kind) VALUES (?,?,?,?,?,?)",
                         (cid, BAY_FEDERAL, str(meta.randint(10_000_000, 99_999_999)), BANKS[BAY_FEDERAL],
                          round(meta.uniform(18000, 240000), 2), "Savings"))
        return aid

    def transfer(from_aid, to, to_name, amount, status, days_ago):
        conn.execute(
            "INSERT INTO transfers (from_account, to_routing, to_number, to_name, amount, status, created_at) "
            "VALUES (?,?,?,?,?,?,?)",
            (from_aid, to["routing"], to["number"], to_name, amount, status, _ts(days_ago)))

    # The decoy line itself. It never holds real money.
    customer("Margaret Wilson (decoy)", 78, "decoy")

    # The story: one live victim, two past victims.
    dorothy = customer("Dorothy Park", 81, "elderly")
    transfer(dorothy, MULE_1, "Federal Reserve Protected Acct", 8500, "pending", 0.01)
    harold = customer("Harold Jenkins", 79, "elderly")
    transfer(harold, MULE_1, "FRB Asset Protection", 26000, "completed", 9)
    june = customer("June Okafor", 83, "elderly")
    transfer(june, MULE_2, "US Treasury Safe Account", 15000, "completed", 4)

    # Victims for the other judge scripts: one wire pending right now, earlier ones already sent.
    for mule, payee, victims in [
        (MULE_BANK_IMPOSTOR, "Secure Holding Acct", [("Evelyn Brooks", 77, 12400, "pending", 0.02),
                                                      ("Frank Morales", 84, 31000, "completed", 6)]),
        (MULE_TECH_SUPPORT, "Refund Reversal", [("Ruth Adler", 80, 4900, "pending", 0.03),
                                                 ("George Tanaka", 76, 9800, "completed", 12)]),
        (MULE_GRANDPARENT, "Court Bail Services", [("Betty Coleman", 82, 7500, "pending", 0.01)]),
        (MULE_IRS, "Treasury Holding Acct", [("Agnes Liu", 79, 6000, "pending", 0.02),
                                             ("Walter Hughes", 85, 18250, "completed", 3)]),
    ]:
        for name, age, amount, status, days in victims:
            transfer(customer(name, age, "elderly"), mule, payee, amount, status, days)

    # The mule accounts at our bank (owners may not know their accounts are being used).
    mule_aids = {}
    for mule, owner, opened in [(MULE_1, "R. Alvarez", 74), (MULE_IRS, "T. Brandt", 41), (HIDDEN_INTERNAL, "D. Okoro", 23)]:
        mule_owner = conn.execute("INSERT INTO customers (name, age, risk_flags, member_since) VALUES (?, 24, 'new account', ?)",
                                  (owner, _ts(opened)[:10])).lastrowid
        mule_aids[mule["number"]] = conn.execute(
            "INSERT INTO accounts (customer_id, routing, number, bank_name, label, balance) VALUES (?,?,?,?,?,?)",
            (mule_owner, mule["routing"], mule["number"], BANKS[BAY_FEDERAL],
             "" if mule is HIDDEN_INTERNAL else "suspected mule", round(meta.uniform(300, 2500), 2))).lastrowid

    # The hidden ring behind the known mules (same story as scripts/seed_nessie.py). Nothing flags these
    # yet: the CREAO investigator finds them in the full ledger, and an analyst approves the blocks.
    transfer(mule_aids[MULE_1["number"]], HIDDEN_1, "consulting services", 24000, "completed", 8)
    transfer(mule_aids[MULE_IRS["number"]], HIDDEN_2, "invoice 2291", 17500, "completed", 2)
    for name, age, amount, days, memo in [("Lillian Ford", 80, 9400, 18, "Federal Reserve Protected Acct"),
                                          ("Raymond Cole", 78, 9900, 12, "FRB secure holding"),
                                          ("Mildred Shaw", 84, 7800, 6, "protected account")]:
        transfer(customer(name, age, "elderly"), HIDDEN_INTERNAL, memo, amount, "completed", days)
        transfer(mule_aids[HIDDEN_INTERNAL["number"]], HIDDEN_1, "consulting services", amount - 200, "completed", max(0, days - 1))
    for name, age, mule, amount, status, days, memo in [
            ("Eleanor Vance", 82, HIDDEN_1, 14000, "completed", 27, "Federal Reserve Protected Acct"),
            ("Arthur Price", 81, HIDDEN_2, 12000, "completed", 15, "US Treasury Safe Account"),
            ("Clara Bennett", 79, HIDDEN_1, 9500, "pending", 0.02, "Fed protected account"),
            ("Nora Diaz", 77, HIDDEN_2, 9000, "pending", 0.03, "US Treasury Safe Account")]:
        transfer(customer(name, age, "elderly"), mule, memo, amount, status, days)

    # About 40 ordinary customers with ordinary transfers, so the ledger looks real.
    for _ in range(40):
        aid = customer(f"{rng.choice(FIRST)} {rng.choice(LAST)}", rng.randint(22, 90))
        for _ in range(rng.randint(2, 5)):
            name, lo, hi = rng.choice(PAYEES)
            payee = {"routing": rng.choice(list(BANKS)[1:]), "number": str(rng.randint(10**7, 10**8 - 1))}
            transfer(aid, payee, name, round(rng.uniform(lo, hi), 2), "completed", rng.uniform(1, 30))



def seed() -> None:
    conn = db.connect()
    for t in ["customers", "accounts", "transfers", "blocklist", "allowlist", "cases", "audit_log"]:
        conn.execute(f"DROP TABLE IF EXISTS {t}")
    db.init(conn)
    rng = random.Random(13)
    meta = random.Random(29)  # member metadata, separate so the story's account numbers never shift

    # CalHacks Federal's core banking: members, accounts and payments from Capital One Nessie (server/bank/nessie.py).
    # Without a Nessie snapshot, fall back to the small generated ledger with the same story.
    from server.bank import nessie
    nessie.clear_flags()
    if not nessie.load_into(conn, BAY_FEDERAL, BANKS[BAY_FEDERAL],
                            {MULE_1["number"]: "suspected mule", MULE_IRS["number"]: "suspected mule"},
                            {MULE_1["number"]: 74, MULE_IRS["number"]: 41, HIDDEN_INTERNAL["number"]: 23}):
        _synthetic_ledger(conn, rng, meta)

    # Known-good accounts that must never be blocked.
    for routing, number, name in [("558903361", "10000001", "Coinbase Deposit Account"),
                                  ("567340122", "20000002", "US Treasury (official)"),
                                  ("551204711", "30000003", "Amazon Payments")]:
        conn.execute("INSERT INTO allowlist VALUES (?,?,?)", (routing, number, name))

    # Earlier decoy-line cases, so the bank's case queue has history. Their mule accounts are confirmed.
    for key, days, summary, status, assignee, protected, mule in HISTORY:
        call_id = f"hist-{key[-4:]}"
        hist = [{"ts": _ts(days), "actor": "scamwatch", "action": "Case opened from decoy call", "note": ""}]
        if mule:
            conn.execute("INSERT INTO blocklist (routing, number, source_call_id, status, created_at) VALUES (?,?,?,?,?)",
                         (mule[0], mule[1], call_id, "confirmed" if status == "Confirmed" else "provisional", _ts(days)))
            hist.append({"ts": _ts(days - 0.001), "actor": "rules", "action": "Mule account blocked (provisional)", "note": f"{BANKS[mule[0]]} ••{mule[1][-4:]}"})
        hist.append({"ts": _ts(days - 0.2), "actor": "analyst", "action": f"Status → {status}",
                     "note": "Closed without a freeze: account belongs to a licensed escrow agent" if status == "Rejected" else f"{assignee} confirmed the freeze"})
        conn.execute("INSERT INTO cases (call_id, key, summary, priority, status, assignee, created_at, status_since, protected, "
                     "history_json, intel_json, sar_markdown) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                     (call_id, key, summary, "High" if protected > 10000 else "Medium", status, assignee, _ts(days),
                      _ts(days - 0.2), protected, json.dumps(hist), "{}", ""))

    conn.execute("INSERT INTO audit_log (ts, actor, action, details_json) VALUES (?,?,?,?)",
                 (_ts(0), "system", "demo_reset", json.dumps({})))
    conn.commit()
    conn.close()


if __name__ == "__main__":
    seed()
    print("Seeded bank.db")
