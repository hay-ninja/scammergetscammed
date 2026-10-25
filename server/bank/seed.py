"""Seed the fictional Bay Federal Credit Union with the demo story.

Routing numbers all start with 5x. That prefix isn't assigned to any real
US bank, so none of these can collide with a real routing number.
"""
import json
import random
from datetime import datetime, timedelta

from server.bank import db

BAY_FEDERAL = "572109086"
BANKS = {
    BAY_FEDERAL: "Bay Federal Credit Union",
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

FIRST = ["James", "Maria", "Robert", "Linda", "Michael", "Susan", "David", "Karen",
         "Wei", "Priya", "Carlos", "Aisha", "Thomas", "Nancy", "Kevin", "Grace",
         "Daniel", "Helen", "Jose", "Emily"]
LAST = ["Nguyen", "Garcia", "Smith", "Chen", "Johnson", "Patel", "Lopez", "Kim",
        "Brown", "Wong", "Davis", "Martinez", "Lee", "Miller", "Singh"]
PAYEES = [("PG&E Utilities", 180, 420), ("Bayview Apartments Rent", 1800, 3200),
          ("Safeway", 60, 240), ("Kaiser Permanente", 40, 400),
          ("Comcast", 70, 140), ("Golden State Insurance", 120, 380)]


def _ts(days_ago: float) -> str:
    return (datetime.now() - timedelta(days=days_ago)).isoformat(timespec="seconds")


def seed() -> None:
    conn = db.connect()
    for t in ["customers", "accounts", "transfers", "blocklist", "allowlist", "cases", "audit_log"]:
        conn.execute(f"DROP TABLE IF EXISTS {t}")
    db.init(conn)
    rng = random.Random(13)

    def customer(name, age, flags=""):
        cid = conn.execute("INSERT INTO customers (name, age, risk_flags) VALUES (?,?,?)",
                           (name, age, flags)).lastrowid
        num = str(rng.randint(10_000_000, 99_999_999))
        aid = conn.execute(
            "INSERT INTO accounts (customer_id, routing, number, bank_name) VALUES (?,?,?,?)",
            (cid, BAY_FEDERAL, num, BANKS[BAY_FEDERAL])).lastrowid
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
    for mule, owner in [(MULE_1, "R. Alvarez"), (MULE_IRS, "T. Brandt")]:
        mule_owner = conn.execute("INSERT INTO customers (name, age) VALUES (?, 24)", (owner,)).lastrowid
        conn.execute("INSERT INTO accounts (customer_id, routing, number, bank_name, label) VALUES (?,?,?,?,?)",
                     (mule_owner, mule["routing"], mule["number"], BANKS[BAY_FEDERAL], "suspected mule"))

    # About 40 ordinary customers with ordinary transfers, so the ledger looks real.
    for _ in range(40):
        aid = customer(f"{rng.choice(FIRST)} {rng.choice(LAST)}", rng.randint(22, 90))
        for _ in range(rng.randint(2, 5)):
            name, lo, hi = rng.choice(PAYEES)
            payee = {"routing": rng.choice(list(BANKS)[1:]), "number": str(rng.randint(10**7, 10**8 - 1))}
            transfer(aid, payee, name, round(rng.uniform(lo, hi), 2), "completed", rng.uniform(1, 30))

    # Known-good accounts that must never be blocked.
    for routing, number, name in [("558903361", "10000001", "Coinbase Deposit Account"),
                                  ("567340122", "20000002", "US Treasury (official)"),
                                  ("551204711", "30000003", "Amazon Payments")]:
        conn.execute("INSERT INTO allowlist VALUES (?,?,?)", (routing, number, name))

    conn.execute("INSERT INTO audit_log (ts, actor, action, details_json) VALUES (?,?,?,?)",
                 (_ts(0), "system", "demo_reset", json.dumps({})))
    conn.commit()
    conn.close()


if __name__ == "__main__":
    seed()
    print("Seeded bank.db")
