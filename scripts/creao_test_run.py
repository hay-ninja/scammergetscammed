"""End-to-end test of the CREAO Fraud Investigator without a phone call.

Plays the Federal Reserve judge script through ScamWatch (scratch DB), starts a real CREAO run with
that case, polls until it finishes, saves it to training/data/creao_runs/, and grades it against the
Nessie answer key.

Usage:  .venv/Scripts/python scripts/creao_test_run.py
Needs CREAO_API_KEY, CREAO_AGENT_ID (and the ledger loaded by scripts/seed_nessie.py).
"""
import asyncio
import json
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from server import config  # noqa: E402

config.DB_PATH = Path(tempfile.mkdtemp()) / "creao_test.db"
from server import creao  # noqa: E402
from server.bank import seed  # noqa: E402
from server.scamwatch.session import CallSession  # noqa: E402

sys.path.insert(0, str(ROOT / "scripts"))
from grade_investigation import KEY, grade  # noqa: E402


async def main() -> None:
    if not creao.enabled():
        sys.exit("Set CREAO_API_KEY and CREAO_AGENT_ID in .env first.")
    seed.seed()
    s = CallSession(source="creao-test")
    script = json.loads((ROOT / "scripts" / "judge_script.json").read_text())
    for t in script["turns"]:
        (s.caller_said if t["speaker"] == "caller" else s.margaret_said)(t["text"])
    s.end()
    print("blocked:", [f"{a['routing']}/{a['number']}" for a in s.state["accounts"] if a["status"] == "blocked"])
    t0 = time.time()

    async def update():
        inv = s.state.get("investigation") or {}
        print(f"  [{time.time() - t0:5.0f}s] {inv.get('status')} run={inv.get('run_id')} {inv.get('error') or ''}", flush=True)

    await creao.start(s.state, update)
    while s.state["investigation"]["status"] in ("queued", "running"):
        await asyncio.sleep(5)
    inv = s.state["investigation"]
    if inv["status"] != "completed":
        print("FAILED:", inv.get("error"), "\n", (inv.get("markdown") or "")[:1500])
        return
    print(f"done in {(inv['finished_at'] - inv['started_at']) / 60:.1f} min · run {inv['run_id']}")
    print(json.dumps(grade(inv["findings"], json.loads(KEY.read_text())["answer_key"]), indent=2))


if __name__ == "__main__":
    asyncio.run(main())
