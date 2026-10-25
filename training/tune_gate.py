"""Sweep the blocking gate's thresholds with the live classifier, without retraining.

Picks settings on the validation split (never the held-out set), requiring zero false blocks
on every non-scam call we have, then reports the held-out result for the chosen settings.

Usage:  .venv/Scripts/python training/tune_gate.py
"""
import itertools
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from common import HELDOUT, MODELS, PRESSURE, SCAM_STAGES, load_calls, split, windows  # noqa: E402
from server.scamwatch import classifier as clf  # noqa: E402
from server.scamwatch.extractor import extract  # noqa: E402
from server.scamwatch.rules import safe_account_request  # noqa: E402


def cache(calls, model):
    """Per call: is_scam, and per caller line (probs, p_scam, stage, has_account, rule_hit)."""
    out = []
    for c in calls:
        lines = [t["text"] for t in c["turns"] if t["speaker"] == "caller"]
        rows = []
        for (text, _), raw in zip(windows(c), lines):
            r = model.predict(text.split(" [SEP] "))
            rows.append((r["probs"], r["p_scam"], r["stage"], bool(extract(raw)["accounts"]), safe_account_request(raw)))
        out.append((c["is_scam"], any(row[3] for row in rows), rows))
    return out


def gate(rows, score_min, min_pressure, seen_prob, p_gate):
    seen, no = set(), 1.0
    for probs, p, stage, has_acct, rule in rows:
        seen |= {s for s, v in probs.items() if s in SCAM_STAGES and v >= seen_prob}
        if rule:
            seen.add("safe_account_request")
        if p > p_gate:
            no *= 1 - 0.5 * p
        if ((has_acct or stage == "account_details") and "safe_account_request" in seen
                and len(seen & PRESSURE) >= min_pressure and 1 - no >= score_min):
            return True
    return False


def score(cached, params):
    tp = fn = fp = 0
    for is_scam, has_acct, rows in cached:
        hit = gate(rows, *params)
        if not is_scam:
            fp += hit
        elif has_acct:
            tp += hit
            fn += not hit
    return {"recall": round(tp / max(1, tp + fn), 3), "caught": tp, "scams": tp + fn, "false_blocks": fp}


def main() -> None:
    model = clf.load()
    print("model:", model.name)
    train, val, test = split(load_calls())
    tune = cache(val + test, model)
    every_legit = cache([c for c in train if not c["is_scam"]], model) + [x for x in tune if not x[0]]
    held = cache(load_calls(HELDOUT), model)

    current = (0.95, 2, 0.3, 0.6)
    grid = list(itertools.product([0.75, 0.8, 0.85, 0.9, 0.95], [1, 2], [0.2, 0.3], [0.5, 0.6]))
    results, table = [], []
    for params in grid:
        fb = score(every_legit, params)["false_blocks"]
        r = score(tune, params)["recall"]
        table.append({"params": params, "tune_recall": r, "legit_false_blocks": fb, "heldout": score(held, params)})
        if fb:
            continue  # never trade a false block for recall
        # Ties go to the stricter setting: higher score bar, more pressure stages, higher seen threshold.
        results.append((r, params[0], params[1], params[2], params))
    best = max(results)[-1] if results else current
    names = ["score_min", "min_pressure_stages", "seen_min_prob", "p_scam_counts_above"]
    report = {
        "model": model.name,
        "current": dict(zip(names, current)), "current_tune": score(tune, current), "current_heldout": score(held, current),
        "chosen": dict(zip(names, best)), "chosen_tune": score(tune, best), "chosen_heldout": score(held, best),
        "legit_calls_checked": len(every_legit), "grid": table,
    }
    print(json.dumps(report, indent=2))
    (MODELS / "gate_tuning.json").write_text(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
