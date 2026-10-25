"""Regression check: replay recorded calls through ScamWatch and assert what should be blocked.

Usage:  .venv/Scripts/python scripts/replay_call.py
Uses a scratch copy of bank.db. Exits non-zero if any expectation fails.
"""
import json
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from server import config  # noqa: E402

_scratch = Path(tempfile.mkdtemp()) / "replay.db"
config.DB_PATH = _scratch
from server.bank import seed  # noqa: E402
from server.scamwatch.session import CallSession  # noqa: E402

# fixture -> accounts (routing, number) that must end up blocked
EXPECT = {
    "real_call_1.json": {("572109086", "44102287"), ("551204711", "77305196")},
    "real_call_2.json": {("572109086", "44102287")},  # chunked numbers, confirmed read-backs, 5 lines apart
}


def main() -> int:
    failed = 0
    for name, want in EXPECT.items():
        seed.seed()
        call = json.loads((ROOT / "scripts" / "fixtures" / name).read_text(encoding="utf-8"))
        s = CallSession(source="replay")
        for t in call["turns"]:
            if t["speaker"] == "caller":
                s.caller_said(t["text"], ts=1_000_000 + t["t"])
            else:
                s.margaret_said(t["text"])
        got = {(a["routing"], a["number"]) for a in s.state["accounts"] if a["status"] == "blocked"}
        seen = [(a["routing"], a["number"], a["status"], [k for k, v in a["gate"].items() if not v]) for a in s.state["accounts"]]
        ok = got == want
        failed += not ok
        print(f"{'PASS' if ok else 'FAIL'} {name}: blocked={sorted(got)} all={seen} protected=${s.state['impact']['protected_total']:,.0f}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
