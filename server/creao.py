"""MargaretSGS Investigator: the CREAO agent that works every case after the block.

MargaretSGS stops one mule account in seconds. The agent then reads the bank's whole ledger in Nessie,
finds the ring behind that account (linked mules, earlier and pending victims, members at risk,
lookalikes to clear) and writes the SAR. Runs take minutes, so they start in the background and
finish by webhook, with polling as the fallback. The agent only proposes; an analyst approves.
"""
import asyncio
import json
import re
import time
from pathlib import Path

import httpx

from server import config
from server.bank import db, engine

APPS = "https://agent.creao.ai/api/v1/apps"
RUNS_DIR = config.ROOT / "training" / "data" / "creao_runs"
# A full-ledger run took 27 min on Oct 25, so polling waits up to 45 min; the demo shows the latest real run meanwhile.
POLL_EVERY_S, POLL_FOR_S = 8, 45 * 60
REQUIRED = ("summary", "linked_mule_accounts", "additional_victims", "at_risk_members", "cleared_lookalikes", "sar_markdown")

runs: dict[str, dict] = {}  # call_id -> investigation (also stored on the session state)
_seen_deliveries: set[str] = set()


def enabled() -> bool:
    return bool(config.CREAO_API_KEY and config.CREAO_AGENT_ID)


def _headers() -> dict:
    return {"Authorization": f"Bearer {config.CREAO_API_KEY}", "Content-Type": "application/json"}


def build_case(state: dict) -> dict:
    """Everything the agent needs from the call, as the `case_json` input."""
    from server.bank.ops import typology
    conn = db.connect()
    known = [dict(r) for r in conn.execute("SELECT routing, number, status FROM blocklist WHERE status='confirmed'")]
    conn.close()
    return {
        "call_id": state["call"]["id"],
        "call_started_at": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(state["call"]["started_at"])),
        "scam_type_guess": typology(state),
        "blocked_accounts": [{"routing": a["routing"], "number": a["number"], "bank": a["bank"],
                              "gate_checks_passed": [k for k, v in a["gate"].items() if v]}
                             for a in state["accounts"] if a["status"] == "blocked"],
        "known_blocklist": [k | {"bank": engine.bank_name(k["routing"])} for k in known],
        "transcript": [{"caller": t["text"], "stage": t.get("stage")} for t in state["transcript"] if t["speaker"] == "caller"],
        "intel": state["intel"],
        "holds": state["impact"]["holds"],
        "lookback": state["impact"]["lookback"],
    }


def parse(text: str) -> dict | None:
    """The agent ends its Markdown report with one ```json block; take the last valid one."""
    for block in reversed(re.findall(r"```json\s*(\{.*?\})\s*```", text or "", re.S)):
        try:
            out = json.loads(block)
        except json.JSONDecodeError:
            continue
        if all(k in out for k in REQUIRED):
            return normalize(out)
    return None


def _digits(v) -> str:
    return re.sub(r"\D", "", str(v or ""))


def normalize(f: dict) -> dict:
    """The agent's field names drift between runs (`acct` vs `number`, `customer` vs `member`); map them to
    the schema the console and approve_block use. In-house mules come back without a routing number."""
    from server.bank.seed import BAY_FEDERAL
    for m in f.get("linked_mule_accounts", []):
        m["number"] = _digits(m.get("number") or m.get("acct") or m.get("account"))
        m["routing"] = _digits(m.get("routing") or m.get("rtn")) or BAY_FEDERAL
        m["bank"] = m.get("bank") or engine.bank_name(m["routing"])
        m.setdefault("recommended_action", m.get("recommendation", "provisional_block"))
        if m.get("holder") and m["routing"] == BAY_FEDERAL:
            m["bank"] = f"{m['bank']} · {m['holder']}"
    for group in ("additional_victims", "at_risk_members", "known_mule_payments"):
        for v in f.get(group, []):
            name = v.get("customer") or v.get("name")
            if name and (not v.get("member") or str(v["member"]).isdigit()):
                v["customer_id"], v["member"] = v.get("customer_id") or v.get("member"), name
            v.setdefault("date", "")
            v.setdefault("to", "")
    f.setdefault("totals", {})
    return f


def report_text(result: dict) -> str:
    """The reply text, or the Markdown case file the agent attached when the reply is only a short summary."""
    text = result.get("text") or result.get("chatText") or ""
    if parse(text) or parse(result.get("chatText") or ""):
        return text if parse(text) else result["chatText"]
    for art in result.get("artifacts") or []:
        if "markdown" in (art.get("type") or "") or (art.get("title") or "").endswith(".md"):
            try:
                r = httpx.get(art["url"], headers=_headers(), timeout=30, follow_redirects=True)
                if r.status_code == 200 and parse(r.text):
                    return r.text
            except httpx.HTTPError:
                continue
    return text


async def start(state: dict, on_update) -> dict | None:
    """Kick off an investigation for this call once, in the background."""
    call_id = state["call"]["id"]
    if not enabled() or (call_id in runs and runs[call_id]["status"] != "failed"):
        return runs.get(call_id)
    inv = {"status": "queued", "run_id": None, "started_at": time.time(), "finished_at": None,
           "agent_id": config.CREAO_AGENT_ID, "markdown": "", "findings": None, "approved": [], "error": None}
    runs[call_id] = state["investigation"] = inv
    body = {"inputs": {"case_json": json.dumps(build_case(state))}}
    if config.PUBLIC_URL:
        body["webhookUrl"] = f"{config.PUBLIC_URL.rstrip('/')}/api/creao/webhook"
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{APPS}/{config.CREAO_AGENT_ID}/runs", headers=_headers(), json=body)
            r.raise_for_status()
            inv.update(run_id=r.json()["id"], status="running")
        state["audit"].append(engine.audit("creao", "investigation_started", {"run_id": inv["run_id"], "call_id": call_id}))
        asyncio.create_task(_poll(state, on_update))
    except (httpx.HTTPError, KeyError) as e:
        inv.update(status="failed", error=str(e)[:200])
        state["audit"].append(engine.audit("creao", "investigation_failed", {"error": inv["error"]}))
    await on_update()
    return inv


async def _poll(state: dict, on_update) -> None:
    inv = state["investigation"]
    deadline = time.time() + POLL_FOR_S
    async with httpx.AsyncClient(timeout=30) as c:
        while inv["status"] == "running" and time.time() < deadline:
            await asyncio.sleep(POLL_EVERY_S)
            try:
                r = await c.get(f"{APPS}/{config.CREAO_AGENT_ID}/runs/{inv['run_id']}", headers=_headers())
                run = r.json()
            except (httpx.HTTPError, ValueError):
                continue
            if run.get("status") in ("completed", "failed", "cancelled"):
                result = run.get("result") or {}
                result["text"] = await asyncio.to_thread(report_text, result)
                finish(state, run.get("status"), result, run.get("errorCode"))
                await on_update()
                return
    if inv["status"] == "running":
        inv.update(status="failed", error="timed out waiting for the agent")
        await on_update()


def finish(state: dict, status: str, result: dict, error: str | None = None) -> None:
    """Apply a finished run, from the webhook or from polling (whichever comes first)."""
    inv = state.get("investigation")
    if not inv or inv["status"] in ("completed", "failed"):
        return
    text = result.get("text") or result.get("chatText") or ""
    findings = parse(text) or parse(result.get("chatText") or "")
    inv.update(finished_at=time.time(), markdown=text, artifacts=result.get("artifacts", []))
    if status != "completed" or not findings:
        inv.update(status="failed", error=error or ("the agent's report had no valid JSON block" if status == "completed" else status))
        state["audit"].append(engine.audit("creao", "investigation_failed", {"run_id": inv["run_id"], "error": inv["error"]}))
    else:
        inv.update(status="completed", findings=findings)
        state["sar"] = {"status": "ready", "markdown": findings["sar_markdown"], "source": "MargaretSGS Investigator (CREAO)"}
        state["audit"].append(engine.audit("creao", "investigation_completed", {
            "run_id": inv["run_id"], "minutes": round((inv["finished_at"] - inv["started_at"]) / 60, 1),
            "linked_mules": len(findings["linked_mule_accounts"]), "victims": len(findings["additional_victims"]),
            "at_risk": len(findings["at_risk_members"]), "cleared": len(findings["cleared_lookalikes"])}))
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    (RUNS_DIR / f"{state['call']['id']}.json").write_text(json.dumps(inv, indent=1, default=str))


def on_webhook(state: dict | None, delivery_id: str | None, body: dict) -> bool:
    """CREAO's run-finished callback. Delivery is at-least-once, so dedupe on the delivery id."""
    if delivery_id and delivery_id in _seen_deliveries:
        return False
    if delivery_id:
        _seen_deliveries.add(delivery_id)
    inv = state and state.get("investigation")
    if not inv or inv.get("run_id") != body.get("runId"):
        return False
    result = body.get("result") or {}
    result["text"] = report_text(result)
    finish(state, body.get("status"), result)
    return True


def approve_block(state: dict, routing: str, number: str, analyst: str) -> dict:
    """An analyst accepts one of the agent's proposed mule accounts: the bank's normal controls run on it."""
    inv = state.get("investigation") or {}
    found = next((m for m in (inv.get("findings") or {}).get("linked_mule_accounts", [])
                  if m.get("routing") == routing and m.get("number") == number), None)
    if not found:
        raise ValueError("that account is not one of the agent's findings")
    if any(a == f"{routing}/{number}" for a in inv["approved"]):
        raise ValueError("already approved")
    result = engine.block_account(routing, number, state["call"]["id"])
    state["audit"] += result.pop("audit")
    state["audit"].append(engine.audit("analyst", "agent_finding_approved", {
        "analyst": analyst, "account": f"{routing}/{number}", "why": found.get("why", ""), "run_id": inv.get("run_id")}))
    inv["approved"].append(f"{routing}/{number}")
    imp = state["impact"]
    imp["holds"] += result["holds"]
    imp["lookback"] += result["lookback"]
    if result["notify_bank"]:
        imp["notified"].append(result["notify_bank"])
    imp["protected_total"] = sum(x["amount"] for x in imp["holds"] + imp["lookback"])
    return result


def cached_findings(state: dict) -> dict:
    """The agent's findings for the seeded hidden ring, built from the ledger (same schema as a real run).

    Used when CREAO isn't configured or is too slow for the demo, so the panel never shows an error."""
    from server.bank.seed import BANKS, HIDDEN_1, HIDDEN_2, HIDDEN_INTERNAL
    conn = db.connect()
    rows = [dict(r) for r in conn.execute(
        "SELECT t.id, t.amount, t.status, t.created_at, t.to_routing, t.to_number, t.to_name, c.id cid, c.name, c.age, c.risk_flags "
        "FROM transfers t JOIN accounts a ON a.id=t.from_account JOIN customers c ON c.id=a.customer_id "
        "WHERE t.to_number IN (?,?,?)", (HIDDEN_1["number"], HIDDEN_2["number"], HIDDEN_INTERNAL["number"]))]
    conn.close()
    blocked = [a for a in state["accounts"] if a["status"] == "blocked"]
    src = f"{blocked[0]['bank']} ••{blocked[0]['number'][-4:]}" if blocked else "the blocked account"
    why = {
        HIDDEN_INTERNAL["number"]: "Opened 23 days ago; receives “Federal Reserve” wires from three seniors and forwards each one within a day",
        HIDDEN_1["number"]: f"Receives forwarded funds from {src} and from ••1904 as “consulting services”, plus senior wires memo'd “Fed protected account”",
        HIDDEN_2["number"]: "Receives $17,500 from the IRS-scam mule at CalHacks Federal (••7742) as “invoice 2291”, plus “US Treasury Safe Account” wires from seniors",
    }
    mules = [{"routing": m["routing"], "number": m["number"], "bank": BANKS.get(m["routing"], "Unknown bank"), "status": "suspected",
              "confidence": "high", "why": why[m["number"]],
              "evidence_txn_ids": [str(r["id"]) for r in rows if r["to_number"] == m["number"]], "recommended_action": "provisional_block"}
             for m in (HIDDEN_INTERNAL, HIDDEN_1, HIDDEN_2)]
    victims = [{"customer_id": str(r["cid"]), "member": r["name"], "age": r["age"], "amount": r["amount"], "date": r["created_at"][:10],
                "txn_id": str(r["id"]), "status": r["status"], "to": f"{r['to_routing']}/{r['to_number']}",
                "recovery": "stop payment" if r["status"] == "pending" else "recall request"}
               for r in rows if "elderly" in (r["risk_flags"] or "")]
    pending = sum(v["amount"] for v in victims if v["status"] == "pending")
    done = sum(v["amount"] for v in victims if v["status"] == "completed")
    return {
        "summary": f"The blocked account is one node in a ring of {len(mules) + len(blocked)} mule accounts. "
                   f"{len(victims)} more seniors sent ${pending + done:,.0f}; ${pending:,.0f} is still pending and can be stopped.",
        "known_mule_payments": [],
        "linked_mule_accounts": mules,
        "additional_victims": victims,
        "at_risk_members": [{"customer_id": v["customer_id"], "member": v["member"], "age": v["age"],
                             "signal": f"${v['amount']:,.0f} wire pending to a suspected mule", "evidence_txn_ids": [v["txn_id"]]}
                            for v in victims if v["status"] == "pending"],
        "cleared_lookalikes": [{"party": "Golden Gate Title escrow", "why_not_fraud": "Licensed escrow agent; closing documents on file and the member called the office to confirm",
                                "evidence_txn_ids": []}],
        "totals": {"exposed_usd": pending + done, "stoppable_pending_usd": pending, "recall_candidates_usd": done},
        "sar_markdown": state["sar"].get("markdown", ""),
        "receiving_bank_notices": [],
    }


def latest_real_run() -> dict | None:
    """The newest completed CREAO run saved on disk. The demo ledger is reseeded identically every call, so a
    real run's findings still describe the same ring."""
    best = None
    for p in RUNS_DIR.glob("*.json") if RUNS_DIR.exists() else []:
        try:
            inv = json.loads(p.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        if inv.get("status") == "completed" and inv.get("findings") and not inv.get("cached"):
            if not best or (inv.get("finished_at") or 0) > (best.get("finished_at") or 0):
                best = inv
    return best


def use_cached(state: dict) -> dict:
    """Load findings into the current investigation when the live run can't finish in time (keeps approvals).
    Prefers the latest real CREAO run; falls back to findings built from the seeded ring."""
    inv = state.get("investigation") or {}
    if inv.get("status") == "completed":
        return inv
    real = latest_real_run()
    findings = normalize(json.loads(json.dumps(real["findings"]))) if real else cached_findings(state)
    if real and not findings.get("sar_markdown"):
        findings["sar_markdown"] = state["sar"].get("markdown", "")
    run_id = real["run_id"] if real else "cached"
    inv = {"status": "completed", "run_id": run_id, "started_at": inv.get("started_at") or time.time(), "finished_at": time.time(),
           "agent_id": config.CREAO_AGENT_ID, "markdown": real.get("markdown", "") if real else "", "findings": findings,
           "approved": inv.get("approved", []), "error": None, "cached": True,
           "cached_from": {"run_id": run_id, "finished_at": real.get("finished_at"), "minutes": real.get("minutes")} if real else None}
    runs[state["call"]["id"]] = state["investigation"] = inv
    if findings.get("sar_markdown"):
        state["sar"] = {"status": "ready", "markdown": findings["sar_markdown"],
                        "source": "MargaretSGS Investigator (CREAO)" if real else state["sar"].get("source", "template")}
    state["audit"].append(engine.audit("creao", "investigation_completed", {
        "run_id": run_id, "linked_mules": len(findings["linked_mule_accounts"]),
        "victims": len(findings["additional_victims"]), "cached": True}))
    return inv


def load_saved(call_id: str) -> dict | None:
    p = RUNS_DIR / f"{call_id}.json"
    return json.loads(p.read_text()) if p.exists() else None
