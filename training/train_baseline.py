"""Train the always-available baseline: TF-IDF + logistic regression on caller-line windows.

Usage:  .venv/Scripts/python training/train_baseline.py
Saves training/models/baseline.joblib and training/models/baseline_metrics.json.
The live server picks up baseline.joblib automatically on restart.
"""
import json
import random
import sys
import time

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.pipeline import make_pipeline

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from common import MODELS, call_level, heldout_eval, load_calls, split, windows  # noqa: E402


def main() -> None:
    calls = load_calls()
    train, val, test = split(calls)
    rng = random.Random(1)
    Xtr, ytr = zip(*[w for c in train for w in windows(c, rng)])
    Xte, yte = zip(*[w for c in test for w in windows(c)])
    print(f"{len(calls)} calls -> {len(Xtr)} train windows, {len(Xte)} test windows")

    model = make_pipeline(
        TfidfVectorizer(ngram_range=(1, 3), min_df=2, sublinear_tf=True),
        LogisticRegression(max_iter=2000, class_weight="balanced", C=4.0),
    )
    t0 = time.time()
    model.fit(Xtr, ytr)
    print(f"trained in {time.time() - t0:.1f}s")

    pred = model.predict(Xte)
    report = classification_report(yte, pred, output_dict=True, zero_division=0)
    print(classification_report(yte, pred, zero_division=0))
    labels = sorted(set(yte) | set(pred))

    from server.scamwatch.classifier import SCAM_STAGES

    def predict(text):
        p = model.predict_proba([text])[0]
        probs = dict(zip(model.classes_, p))
        stage = max(probs, key=probs.get)
        return stage, sum(v for k, v in probs.items() if k in SCAM_STAGES), probs

    t0 = time.time()
    calls_eval = call_level(test, predict)
    latency_ms = (time.time() - t0) * 1000 / max(1, len(Xte))
    print("call-level:", calls_eval)
    heldout = heldout_eval(predict)
    print("held-out:", heldout)

    MODELS.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODELS / "baseline.joblib")
    metrics = {
        "model": "tfidf-logreg", "n_calls": len(calls), "n_train_windows": len(Xtr), "n_test_windows": len(Xte),
        "macro_f1": round(report["macro avg"]["f1-score"], 3), "accuracy": round(report["accuracy"], 3),
        "per_stage_f1": {k: round(v["f1-score"], 3) for k, v in report.items() if k in labels},
        "confusion": {"labels": labels, "matrix": confusion_matrix(yte, pred, labels=labels).tolist()},
        "call_level": calls_eval, "latency_ms_per_window": round(latency_ms, 2), "heldout": heldout,
    }
    (MODELS / "baseline_metrics.json").write_text(json.dumps(metrics, indent=2))
    print(f"Saved {MODELS / 'baseline.joblib'}")


if __name__ == "__main__":
    sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
    main()
