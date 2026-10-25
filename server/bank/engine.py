"""Bank payment controls: blocklist, holds, lookback, freeze approval, audit."""
import json
from datetime import datetime, timedelta

from server.bank import db
from server.bank.seed import BANKS, BAY_FEDERAL


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def audit(actor: str, action: str, details: dict) -> dict:
    row = {"ts": _now(), "actor": actor, "action": action, "details": details}
    conn = db.connect()
    conn.execute("INSERT INTO audit_log (ts, actor, action, details_json) VALUES (?,?,?,?)",
                 (row["ts"], actor, action, json.dumps(details)))
    conn.commit()
    conn.close()
    return row


def bank_name(routing: str) -> str:
    return BANKS.get(routing, "Unknown bank")


def is_allowlisted(routing: str, number: str) -> str | None:
    conn = db.connect()
    row = conn.execute("SELECT name FROM allowlist WHERE routing=? AND number=?", (routing, number)).fetchone()
    conn.close()
    return row["name"] if row else None


def block_account(routing: str, number: str, call_id: str) -> dict:
    """Run every payment control for a harvested mule account.

    Holds are reversible, so they happen automatically. Freezing an account
    at our bank waits for a human analyst (segregation of duties).
    """
    conn = db.connect()
    exists = conn.execute("SELECT 1 FROM blocklist WHERE routing=? AND number=?", (routing, number)).fetchone()
    if not exists:
        conn.execute("INSERT INTO blocklist (routing, number, source_call_id, status, created_at) VALUES (?,?,?,?,?)",
                     (routing, number, call_id, "provisional", _now()))

    def rows(status: str, since_days: int | None = None):
        q = ("SELECT t.id, t.amount, t.created_at, t.to_name, c.name, c.age FROM transfers t "
             "JOIN accounts a ON a.id = t.from_account JOIN customers c ON c.id = a.customer_id "
             "WHERE t.to_routing=? AND t.to_number=? AND t.status=?")
        args = [routing, number, status]
        if since_days:
            q += " AND t.created_at >= ?"
            args.append((datetime.now() - timedelta(days=since_days)).isoformat(timespec="seconds"))
        return conn.execute(q, args).fetchall()

    holds = [{"transfer_id": r[0], "amount": r[1], "customer": r[4], "age": r[5], "memo": r[3]}
             for r in rows("pending")]
    for h in holds:
        conn.execute("UPDATE transfers SET status='held' WHERE id=?", (h["transfer_id"],))

    lookback = [{"transfer_id": r[0], "amount": r[1], "customer": r[4], "age": r[5],
                 "days_ago": max(0, (datetime.now() - datetime.fromisoformat(r[2])).days), "memo": r[3]}
                for r in rows("completed", since_days=30)]
    for v in lookback:
        conn.execute("UPDATE transfers SET status='recall_requested' WHERE id=?", (v["transfer_id"],))

    internal = conn.execute("SELECT id FROM accounts WHERE routing=? AND number=?", (routing, number)).fetchone()
    if internal:
        conn.execute("UPDATE accounts SET status='held_review' WHERE id=?", (internal["id"],))
    conn.commit()
    conn.close()

    result = {
        "routing": routing, "number": number, "bank": bank_name(routing),
        "internal": bool(internal), "holds": holds, "lookback": lookback,
        "notify_bank": None if internal else bank_name(routing),
    }
    rows = [audit("rules", "blocklist_provisional", {"routing": routing, "number": number, "call_id": call_id})]
    rows += [audit("rules", "transfer_held", h) for h in holds]
    rows += [audit("rules", "recall_requested", v) for v in lookback]
    if internal:
        rows.append(audit("rules", "mule_account_held_for_review", {"routing": routing, "number": number}))
    else:
        rows.append(audit("rules", "receiving_bank_notified_simulated", {"bank": result["notify_bank"]}))
    result["audit"] = rows
    return result


def approve_freeze(analyst: str = "analyst") -> list[dict]:
    """Human-only action: confirm the provisional blocks and freeze our mule accounts."""
    conn = db.connect()
    prov = conn.execute("SELECT routing, number FROM blocklist WHERE status='provisional'").fetchall()
    conn.execute("UPDATE blocklist SET status='confirmed' WHERE status='provisional'")
    frozen = []
    for r in prov:
        cur = conn.execute("UPDATE accounts SET status='frozen' WHERE routing=? AND number=? AND status='held_review'",
                           (r["routing"], r["number"]))
        if cur.rowcount:
            frozen.append({"routing": r["routing"], "number": r["number"]})
    conn.commit()
    conn.close()
    audit(analyst, "freeze_approved", {"confirmed": [dict(r) for r in prov], "frozen": frozen})
    return frozen


def ledger_snapshot() -> dict:
    """Small view of the bank for the dashboard."""
    conn = db.connect()
    flagged = conn.execute(
        "SELECT t.id, t.amount, t.status, t.to_name, t.to_routing, t.to_number, c.name, c.age FROM transfers t "
        "JOIN accounts a ON a.id=t.from_account JOIN customers c ON c.id=a.customer_id "
        "WHERE t.status IN ('pending','held','recall_requested') ORDER BY t.amount DESC").fetchall()
    counts = conn.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
    conn.close()
    return {
        "customers": counts,
        "watch": [{"transfer_id": r[0], "amount": r[1], "status": r[2], "memo": r[3],
                   "to": f"{bank_name(r[4])} ••{r[5][-4:]}", "customer": r[6], "age": r[7]} for r in flagged],
        "our_routing": BAY_FEDERAL,
    }
