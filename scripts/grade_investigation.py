"""Grade a CREAO investigation against the Nessie ledger's answer key (scripts/seed_nessie.py).

Usage:  .venv/Scripts/python scripts/grade_investigation.py                 # newest run in training/data/creao_runs
        .venv/Scripts/python scripts/grade_investigation.py path/to/run.json  # or a saved run / raw agent JSON
Prints hidden mule accounts found, victims found, members at risk found, and false accusations.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KEY = ROOT / "training" / "data" / "nessie_map.json"
RUNS = ROOT / "training" / "data" / "creao_runs"


def norm(s) -> str:
    return str(s or "").lower().replace(".", "").strip()


def grade(findings: dict, key: dict) -> dict:
    mules = {norm(f"{m.get('routing')}/{m.get('number')}") for m in findings.get("linked_mule_accounts", [])}
    hidden = {norm(h["account"]) for h in key["hidden_mules"]}
    known = {norm(k) for k in key["known_mules"]}
    named = lambda rows: {norm(r.get("member") or r.get("party") or r.get("name")) for r in rows} | {norm(r.get("member_id")) for r in rows}  # noqa: E731
    victims_said = named(findings.get("additional_victims", []) + findings.get("known_mule_payments", []))
    risk_said = named(findings.get("at_risk_members", []))
    hidden_v = key["hidden_victims"]
    lookalikes = key["lookalikes"]
    accused = victims_said | risk_said
    false_acc = [l["name"] for l in lookalikes if norm(l["name"]) in accused or norm(l["member_id"]) in accused]
    cleared = named(findings.get("cleared_lookalikes", []))
    return {
        "hidden_mules_found": f"{len(mules & hidden)}/{len(hidden)}", "hidden_mules_missed": sorted(hidden - mules),
        "unexpected_mules": sorted(mules - hidden - known),
        "hidden_victims_found": f"{sum(norm(v['name']) in victims_said or norm(v['member_id']) in victims_said for v in hidden_v)}/{len(hidden_v)}",
        "at_risk_found": f"{sum(norm(a['name']) in risk_said or norm(a['member_id']) in risk_said for a in key['at_risk'])}/{len(key['at_risk'])}",
        "lookalikes_cleared": f"{sum(norm(l['name']) in cleared or norm(l['member_id']) in cleared for l in lookalikes)}/{len(lookalikes)}",
        "false_accusations": false_acc,
        "sar_chars": len(findings.get("sar_markdown", "")),
    }


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else max(RUNS.glob("*.json"), key=lambda p: p.stat().st_mtime)
    data = json.loads(path.read_text())
    findings = data.get("findings") or data
    key = json.loads(KEY.read_text())["answer_key"]
    print(f"{path.name}:")
    print(json.dumps(grade(findings, key), indent=2))


if __name__ == "__main__":
    main()
