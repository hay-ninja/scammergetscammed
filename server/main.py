"""FastAPI app: dashboard websocket, demo controls, and the text simulator API.

Run:  .venv/Scripts/python -m uvicorn server.main:app --port 8000
"""
import asyncio
import json
import time

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from server import config, creao, sar
from server.bank import engine, ops, seed
from server.scamwatch import session as sess

app = FastAPI(title="ScammersGetScammed")


class Hub:
    """Holds the one live call and pushes full state snapshots to dashboards."""

    def __init__(self):
        self.session: sess.CallSession | None = None
        self.clients: set[WebSocket] = set()
        self.flash: str | None = None  # one-shot animation cue, e.g. "moment"

    def snapshot(self) -> dict:
        s = self.session.state if self.session else None
        return {"session": s, "ledger": engine.ledger_snapshot(), "phone": config.TWILIO_PHONE_NUMBER,
                "model": sess.model_name(), "brain": BRAINS[settings["brain"]], "flash": self.flash, "ts": time.time(),
                "gate": {"min_score": config.GATE_MIN_SCAM_SCORE, "min_pressure": config.GATE_MIN_PRESSURE_STAGES},
                "creao_enabled": creao.enabled()}

    def start(self, source: str) -> sess.CallSession:
        self.session = sess.CallSession(source=source)
        ops.open_case(self.session.state["call"]["id"])
        return self.session

    async def broadcast(self) -> None:
        if self.session:
            ops.sync_case(self.session.state)
        msg = json.dumps(self.snapshot(), default=str)
        self.flash = None
        dead = []
        for ws in self.clients:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.clients.discard(ws)

    async def handle_events(self, events: list[str]) -> None:
        if "bank_found" in events and "moment" not in events:
            self.flash = "bank_found"  # first flag: the scammer named the bank; the block follows with the account
        if "moment" in events:
            self.flash = "moment"
            asyncio.create_task(self._draft_sar())
            asyncio.create_task(self._webhook())

    async def _webhook(self) -> None:
        """Tell the bank's own systems (case management, payment screening) about new blocks."""
        if not config.WEBHOOK_URL or not self.session:
            return
        s = self.session.state
        blocked = [{"routing": a["routing"], "number": a["number"], "bank": a["bank"], "gate": a["gate"]}
                   for a in s["accounts"] if a["status"] == "blocked"]
        body = {"event": "mule_account.blocked", "call_id": s["call"]["id"], "accounts": blocked,
                "holds": s["impact"]["holds"], "lookback": s["impact"]["lookback"],
                "protected_total": s["impact"]["protected_total"], "model": s["model"], "ts": time.time()}
        try:
            async with httpx.AsyncClient(timeout=5) as c:
                await c.post(config.WEBHOOK_URL, json=body)
            s["audit"].append(engine.audit("scamwatch", "webhook_sent", {"url": config.WEBHOOK_URL, "accounts": len(blocked)}))
        except httpx.HTTPError as e:
            s["audit"].append(engine.audit("scamwatch", "webhook_failed", {"error": str(e)[:120]}))

    async def _draft_sar(self) -> None:
        s = self.session
        if not s:
            return
        s.state["sar"]["status"] = "drafting"
        await self.broadcast()
        await asyncio.sleep(1.5)
        if (s.state.get("investigation") or {}).get("status") == "completed":
            return  # the CREAO investigator's SAR already replaced the template
        # A template draft from the call alone; the CREAO investigator replaces it with the full case SAR.
        s.state["sar"] = {"status": "ready", "markdown": sar.draft(s.state), "source": "template"}
        await self.broadcast()

    async def investigate(self) -> None:
        """Hand the case to the MargaretSGS Investigator (CREAO) (background; finishes by webhook or polling)."""
        s = self.session
        if s and creao.enabled() and any(a["status"] == "blocked" for a in s.state["accounts"]):
            await creao.start(s.state, self.broadcast)


hub = Hub()


@app.on_event("startup")
async def startup() -> None:
    seed.seed()


@app.websocket("/ws/dashboard")
async def dashboard_ws(ws: WebSocket):
    await ws.accept()
    hub.clients.add(ws)
    await ws.send_text(json.dumps(hub.snapshot(), default=str))
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        hub.clients.discard(ws)


@app.get("/api/state")
def state():
    return hub.snapshot()


@app.get("/api/model")
def model_metrics():
    """Metrics for the Model tab: the fine-tuned model if present, else the baseline."""
    for name in ("finetuned_metrics.json", "baseline_metrics.json"):
        p = config.MODELS_DIR / name
        if p.exists():
            return json.loads(p.read_text())
    return {}


@app.get("/api/bench")
def bench_results():
    """The latest Margaret red-team benchmark summary (scripts/bench_margaret.py)."""
    p = config.MODELS_DIR / "bench_margaret.json"
    return json.loads(p.read_text()) if p.exists() else {}


@app.post("/api/reset")
async def reset():
    seed.seed()
    hub.session = None
    await hub.broadcast()
    return {"ok": True}


def _decidable() -> dict:
    s = hub.session.state if hub.session else None
    if not s or not any(a["status"] == "blocked" for a in s["accounts"]):
        raise HTTPException(409, "nothing is awaiting approval")
    imp = s["impact"]
    if imp["freeze_approved"] or imp.get("freeze_rejected"):
        raise HTTPException(409, "this case is already decided")
    return s


@app.post("/api/approve")
async def approve():
    if hub.session:
        s = _decidable()
        hub.session.approve_freeze()
        ops.sync_case(s, {"id": "decision", "action": f"Freeze approved by {ops.ANALYST}",
                          "note": "Provisional blocks confirmed; CalHacks Federal mule account frozen"})
        await hub.broadcast()
    return {"ok": True}


class Reject(BaseModel):
    reason: str


@app.post("/api/reject")
async def reject(body: Reject):
    """The controller can say no. Blocks stay provisional and holds stay until an analyst releases them."""
    reason = body.reason.strip()
    if not reason:
        raise HTTPException(400, "a reason is required to reject a freeze")
    s = _decidable()
    kept = ops.reject_freeze(reason)
    imp = s["impact"]
    imp.update(freeze_pending=False, freeze_rejected=True, reject_reason=reason)
    s["audit"].append({"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "actor": "analyst", "action": "freeze_rejected",
                       "details": {"reason": reason, "provisional_kept": kept}})
    ops.sync_case(s, {"id": "decision", "action": f"Freeze rejected by {ops.ANALYST}", "note": reason})
    await hub.broadcast()
    return {"ok": True, "provisional_kept": kept}


# ---- CalHacks Federal Fraud Ops console ------------------------------------------

def _live_state() -> dict | None:
    return hub.session.state if hub.session else None


@app.get("/api/bank/overview")
def bank_overview():
    return ops.overview(_live_state())


@app.get("/api/bank/members")
def bank_members():
    return {"members": ops.members()}


@app.get("/api/bank/members/{cid}")
def bank_member(cid: int):
    m = ops.member_detail(cid)
    if not m:
        raise HTTPException(404, "no such member")
    return m


@app.get("/api/bank/cases")
def bank_cases():
    return {"cases": ops.cases(_live_state())}


@app.get("/api/bank/cases/{key}")
def bank_case(key: str):
    c = ops.case_detail(key, _live_state())
    if not c:
        raise HTTPException(404, "no such case")
    return c


@app.get("/api/bank/payments")
def bank_payments():
    return {"payments": ops.payments()}


@app.get("/api/bank/blocklist")
def bank_blocklist():
    return {"accounts": ops.blocklist()}


@app.get("/api/bank/audit")
def bank_audit():
    return {"rows": ops.audit_log()}


class Release(BaseModel):
    transfer_id: int


@app.post("/api/bank/release")
async def bank_release(body: Release):
    row = ops.release_hold(body.transfer_id)
    if not row:
        raise HTTPException(409, "that payment is not on hold")
    await hub.broadcast()
    return row


@app.post("/api/bank/simulate_wire")
async def bank_simulate_wire():
    row = ops.simulate_new_wire(_live_state())
    if not row:
        raise HTTPException(409, "no blocked mule account to test against yet")
    await hub.broadcast()
    return row


# ---- text simulator (dev harness + no-phone fallback) -------------------------

class Utterance(BaseModel):
    speaker: str  # "caller" or "margaret"
    text: str
    final: bool = True


class CallStart(BaseModel):
    source: str = "sim"


@app.post("/api/sim/start")
@app.post("/api/call/start")
async def call_start(body: CallStart | None = None):
    """Start a fresh call. Reseeds the bank so every demo starts from the same story."""
    src = body.source if body else "sim"
    live = hub.session and hub.session.state["call"]["status"] == "active" and hub.session.state["call"]["source"] in ("phone", "browser")
    if live and src not in ("phone", "browser"):
        raise HTTPException(409, "a real call is live; the text simulator would replace it")
    seed.seed()
    hub.start(src)
    await hub.broadcast()
    return {"call_id": hub.session.state["call"]["id"]}


@app.post("/api/sim/utterance")
async def sim_utterance(u: Utterance):
    if hub.session and hub.session.state["call"]["status"] != "active":
        # A last speech-to-text line can land after the phone hangs up; it must not open a phantom new call.
        return {"strategy": None, "stage": None, "scam_score": hub.session.state["scam_score"], "events": [], "ignored": "call ended"}
    if not hub.session:
        hub.start("sim")
    s = hub.session
    events: list[str] = []
    if not u.final:
        s.partial(u.speaker, u.text)
    elif u.speaker == "caller":
        events = s.caller_said(u.text)
    else:
        s.margaret_said(u.text)
    await hub.handle_events(events)
    await hub.broadcast()
    return {"strategy": s.state["strategy"], "stage": s.state["current_stage"],
            "scam_score": s.state["scam_score"], "events": events}


@app.post("/api/sim/end")
async def sim_end():
    if hub.session:
        hub.session.end()
        await hub.broadcast()
        asyncio.create_task(hub.investigate())
        # Keep every call for debugging (transcript, what the number extractor heard, gate checks).
        logs = config.ROOT / "training" / "data" / "call_logs"
        logs.mkdir(parents=True, exist_ok=True)
        (logs / f"{hub.session.state['call']['id']}.json").write_text(json.dumps(hub.session.state, default=str, indent=1))
    return {"ok": True, "summary": hub.session.state["summary"] if hub.session else None}


# ---- MargaretSGS Investigator (CREAO): the case work after the block ------------------

@app.post("/api/creao/run")
async def creao_run():
    """Start (or retry) the investigation for the current call."""
    if not creao.enabled():
        raise HTTPException(503, "set CREAO_API_KEY and CREAO_AGENT_ID in .env")
    if not hub.session or not any(a["status"] == "blocked" for a in hub.session.state["accounts"]):
        raise HTTPException(409, "no blocked account on the current call to investigate")
    inv = await creao.start(hub.session.state, hub.broadcast)
    return {k: inv[k] for k in ("status", "run_id", "error")}


@app.post("/api/creao/fallback")
async def creao_fallback():
    """CREAO not configured or too slow for the demo: load the cached findings for the seeded hidden ring."""
    if not hub.session or not any(a["status"] == "blocked" for a in hub.session.state["accounts"]):
        raise HTTPException(409, "no blocked account on the current call to investigate")
    inv = creao.use_cached(hub.session.state)
    await hub.broadcast()
    return {k: inv[k] for k in ("status", "run_id", "error")}


@app.get("/api/creao/investigation")
def creao_investigation():
    inv = hub.session and hub.session.state.get("investigation")
    return inv or {"status": "none", "enabled": creao.enabled()}


@app.post("/api/creao/webhook")
async def creao_webhook(request: Request):
    body = await request.json()
    if creao.on_webhook(hub.session.state if hub.session else None, request.headers.get("x-creao-delivery-id"), body):
        await hub.broadcast()
    return {"ok": True}  # always 2xx quickly, as CREAO asks


class AgentBlock(BaseModel):
    routing: str
    number: str


@app.post("/api/creao/approve_block")
async def creao_approve_block(body: AgentBlock):
    """An analyst accepts one mule account the agent found; the bank's normal controls then run on it."""
    if not hub.session:
        raise HTTPException(409, "no current case")
    try:
        result = creao.approve_block(hub.session.state, body.routing, body.number, ops.ANALYST)
    except ValueError as e:
        raise HTTPException(409, str(e))
    hub.flash = "moment"
    await hub.broadcast()
    return {"holds": result["holds"], "lookback": result["lookback"], "notify_bank": result["notify_bank"]}


# ---- settings: which model is Margaret's brain on the next call ---------------

BRAINS = {"gemini": "Gemini 3.5 Flash-Lite", "stepfun": "StepFun Step 3.7 Flash", "own": "Our Margaret LLM (Vultr)"}
settings = {"brain": "gemini"}


class Settings(BaseModel):
    brain: str


@app.get("/api/settings")
def get_settings():
    available = {k: v for k, v in BRAINS.items()
                 if k == "gemini" or (k == "stepfun" and config.STEPFUN_API_KEY) or (k == "own" and config.OWN_LLM_URL)}
    return {**settings, "available": available}


@app.post("/api/settings")
def set_settings(body: Settings):
    if body.brain not in BRAINS:
        raise HTTPException(400, f"brain must be one of {list(BRAINS)}")
    settings["brain"] = body.brain
    return settings


# ---- public API v1: embed MargaretSGS in a bank's own call stack ----------------
# A bank streams caller lines from its own recorder or contact-center platform and gets back the
# scam stage, score and coaching; blocks arrive by webhook and in the blocklist feed.

def api_key(x_api_key: str | None = Header(default=None)) -> None:
    if config.API_KEY and x_api_key != config.API_KEY:
        raise HTTPException(401, "missing or wrong X-API-Key")


@app.post("/api/v1/calls", dependencies=[Depends(api_key)])
async def v1_start(body: CallStart | None = None):
    return await call_start(body or CallStart(source="api"))


@app.post("/api/v1/calls/{call_id}/lines", dependencies=[Depends(api_key)])
async def v1_line(call_id: str, u: Utterance):
    if not hub.session or hub.session.state["call"]["id"] != call_id:
        raise HTTPException(404, "unknown or finished call")
    r = await sim_utterance(u)
    s = hub.session.state
    return {**r, "accounts": [{k: a[k] for k in ("routing", "number", "bank", "status", "gate")} for a in s["accounts"]],
            "stages_seen": s["stages_seen"], "model": s["model"]}


@app.post("/api/v1/calls/{call_id}/end", dependencies=[Depends(api_key)])
async def v1_end(call_id: str):
    return await sim_end()


@app.get("/api/v1/blocklist", dependencies=[Depends(api_key)])
def v1_blocklist():
    """Feed for payment screening (wire, ACH, Zelle): every provisional or confirmed mule account."""
    from server.bank import db
    conn = db.connect()
    rows = conn.execute("SELECT routing, number, source_call_id, status, created_at FROM blocklist").fetchall()
    conn.close()
    return {"accounts": [dict(r) | {"bank": engine.bank_name(r["routing"])} for r in rows]}


@app.get("/api/health")
def health():
    return {"ok": True, "model": sess.model_name(), "brain": settings["brain"]}


# ---- built dashboard (demo mode: one process serves everything) --------------

if config.WEB_DIST.exists():
    app.mount("/assets", StaticFiles(directory=config.WEB_DIST / "assets"), name="assets")

    @app.get("/")
    def index():
        return FileResponse(config.WEB_DIST / "index.html")
