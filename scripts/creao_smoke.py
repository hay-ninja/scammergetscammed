"""Smoke test for the CREAO investigator: replay a recorded call on a scratch bank, send the case, wait for findings.

Usage:  .venv/Scripts/python scripts/creao_smoke.py [scripts/fixtures/real_call_1.json]
Uses a scratch copy of bank.db. Prints the run id, status changes, and a summary of the parsed findings.
"""
import asyncio
import json
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path

sys.stdout.reconfigure(line_buffering=True)  # runs take minutes; show progress as it happens
ROOT = Path(__file__).resolve().parent.parent
scratch = Path(tempfile.mkdtemp()) / "creao_smoke.db"
os.environ["SGS_DB_PATH"] = str(scratch)
sys.path.insert(0, str(ROOT))

from server import config, creao  # noqa: E402
from server.bank import seed  # noqa: E402
from server.scamwatch.session import CallSession  # noqa: E402


async def main() -> None:
    fixture = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "scripts" / "fixtures" / "real_call_1.json")
    seed.seed()
    s = CallSession(source="smoke")
    for t in json.loads(fixture.read_text())["turns"]:
        if t["speaker"] == "caller":
            s.caller_said(t["text"], ts=1_000_000 + t["t"])  # recorded timing, as in replay_call.py
        else:
            s.margaret_said(t["text"])
    blocked = [a for a in s.state["accounts"] if a["status"] == "blocked"]
    print("blocked:", [(a["routing"], a["number"]) for a in blocked])
    if not blocked:
        sys.exit("nothing blocked, so there is no case to investigate")

    async def on_update():
        inv = s.state.get("investigation") or {}
        print(f"[{time.strftime('%H:%M:%S')}] status={inv.get('status')} run={inv.get('run_id')} error={inv.get('error')}")

    t0 = time.time()
    await creao.start(s.state, on_update)
    while (s.state.get("investigation") or {}).get("status") in ("queued", "running"):
        await asyncio.sleep(5)
    inv = s.state["investigation"]
    print(f"finished in {time.time() - t0:.0f}s: {inv['status']}")
    if inv["status"] == "completed":
        f = inv["findings"]
        print("summary:", f["summary"])
        print("linked mules:", [(m["routing"], m["number"], m.get("confidence")) for m in f["linked_mule_accounts"]])
        print("victims:", len(f["additional_victims"]), "at risk:", len(f["at_risk_members"]), "cleared:", len(f["cleared_lookalikes"]))
    else:
        print("raw report tail:", (inv.get("markdown") or "")[-800:])
    print("saved run:", creao.RUNS_DIR / f"{s.state['call']['id']}.json", "| db:", config.DB_PATH)
    shutil.rmtree(scratch.parent, ignore_errors=True)


asyncio.run(main())
