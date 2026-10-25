"""Play a scripted call through the server as text, with no phone needed.

Usage:  .venv/Scripts/python scripts/sim_call.py [script.json] [--fast]
"""
import json
import sys
import time
from pathlib import Path

import httpx

API = "http://127.0.0.1:8000"


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    fast = "--fast" in sys.argv
    path = Path(args[0]) if args else Path(__file__).parent / "judge_script.json"
    script = json.loads(path.read_text())
    with httpx.Client(base_url=API, timeout=10) as c:
        c.post("/api/sim/start")
        print(f"Playing: {script['name']}")
        for turn in script["turns"]:
            if not fast:
                # Show a partial first so the dashboard looks live.
                words = turn["text"].split()
                c.post("/api/sim/utterance", json={**turn, "text": " ".join(words[: max(1, len(words) // 2)]), "final": False})
                time.sleep(0.6)
            r = c.post("/api/sim/utterance", json=turn).json()
            tag = f"  [{r['stage']} · score {r['scam_score']}]" if turn["speaker"] == "caller" else ""
            moment = "  *** MOMENT ***" if "moment" in r["events"] else ""
            print(f"{turn['speaker']:>8}: {turn['text'][:70]}{tag}{moment}")
            if not fast:
                time.sleep(1.4)
        summary = c.post("/api/sim/end").json()["summary"]
        print("Summary:", summary)


if __name__ == "__main__":
    main()
