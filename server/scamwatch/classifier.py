"""Scam-stage classifier.

Uses the trained model in training/models/ when it exists. Until then a
keyword fallback keeps the whole pipeline demoable.
"""
import re
from pathlib import Path

from server.config import MODELS_DIR

SCAM_STAGES = ["intro", "authority", "fear_urgency", "secrecy", "remote_access",
               "safe_account_request", "account_details"]
BENIGN_STAGES = ["benign_chat", "legit_business", "spam_sales"]
STAGES = SCAM_STAGES + BENIGN_STAGES
PRESSURE_STAGES = {"authority", "fear_urgency", "secrecy", "remote_access"}

_KEYWORDS = {
    "authority": r"federal reserve|social security|\birs\b|medicare|\bfbi\b|treasury|agent|officer|badge|government|department|fraud (?:department|team)|microsoft|apple support",
    "fear_urgency": r"compromised|hacked|hackers|arrest|warrant|suspend|frozen|lose everything|today|immediately|right now|urgent|criminal|stolen|lawsuit|danger",
    "secrecy": r"don'?t tell|do not tell|keep (?:this|it) (?:between|secret|confidential)|nobody|involved|can'?t trust|confidential",
    "remote_access": r"remote|download|anydesk|teamviewer|install|screen ?share|click (?:the|this) link",
    "safe_account_request": r"safe account|protected account|secure account|move (?:your|the) (?:money|funds|savings)|transfer (?:your|the) (?:money|funds|savings)|wire (?:your|the)|withdraw|gift cards?|bitcoin|crypto|gold bars?",
    "account_details": r"routing|account number|account is|acct|\b\d{6,}\b",
    "legit_business": r"appointment|prescription|refill|bill is due|our website|confirm (?:a |the )?(?:recent )?(?:charge|transaction)|wrong number|donation|survey",
    "spam_sales": r"warranty|special offer|limited time offer|vacation|solar",
}


class KeywordClassifier:
    name = "keyword-fallback"

    def predict(self, window: list[str]) -> dict:
        text = " ".join(window[-1:]).lower()
        context = " ".join(window).lower()
        scores = {s: 0.0 for s in STAGES}
        for stage, pat in _KEYWORDS.items():
            hits = len(re.findall(pat, text))
            ctx = len(re.findall(pat, context)) - hits
            scores[stage] = hits * 1.0 + ctx * 0.25
        if max(scores.values()) == 0:
            scores["benign_chat" if not any(scores[s] for s in SCAM_STAGES) else "intro"] = 0.5
        # Money and account stages outrank the rest when present.
        for s in ("account_details", "safe_account_request"):
            if scores[s] >= 1:
                scores[s] += 1.5
        total = sum(scores.values()) or 1.0
        probs = {s: v / total for s, v in scores.items()}
        stage = max(probs, key=probs.get)
        p_scam = sum(probs[s] for s in SCAM_STAGES)
        if stage in BENIGN_STAGES:
            p_scam = min(p_scam, 0.3)
        return {"stage": stage, "probs": probs, "p_scam": round(p_scam, 3)}


class SklearnClassifier:
    name = "tfidf-logreg"

    def __init__(self, path: Path):
        import joblib
        self.model = joblib.load(path)

    def predict(self, window: list[str]) -> dict:
        text = " [SEP] ".join(w.lower() for w in window[-3:])
        p = self.model.predict_proba([text])[0]
        probs = dict(zip(self.model.classes_, p))
        stage = max(probs, key=probs.get)
        p_scam = sum(v for k, v in probs.items() if k in SCAM_STAGES)
        return {"stage": stage, "probs": probs, "p_scam": round(float(p_scam), 3)}


class OnnxClassifier:
    """The fine-tuned ModernBERT, exported to int8 ONNX so it runs on the laptop CPU without torch."""
    name = "finetuned:ModernBERT-base-int8"

    def __init__(self, folder: Path):
        import json

        import numpy as np
        import onnxruntime as ort
        from tokenizers import Tokenizer
        self.np = np
        self.tok = Tokenizer.from_file(str(folder / "tokenizer.json"))
        self.tok.enable_truncation(max_length=192)
        self.labels = json.loads((folder / "labels.json").read_text())
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 2  # leave CPU for the voice pipeline
        self.sess = ort.InferenceSession(str(folder / "model.onnx"), opts, providers=["CPUExecutionProvider"])

    def predict(self, window: list[str]) -> dict:
        np = self.np
        enc = self.tok.encode(" [SEP] ".join(w.lower() for w in window[-3:]))
        logits = self.sess.run(None, {"input_ids": np.array([enc.ids], dtype=np.int64),
                                      "attention_mask": np.array([enc.attention_mask], dtype=np.int64)})[0][0]
        p = np.exp(logits - logits.max())
        p /= p.sum()
        probs = {l: float(v) for l, v in zip(self.labels, p)}
        stage = max(probs, key=probs.get)
        return {"stage": stage, "probs": probs, "p_scam": round(sum(probs.get(s, 0) for s in SCAM_STAGES), 3)}


def load():
    """Best available model: fine-tuned ONNX, then the TF-IDF baseline, then keywords."""
    import os
    onnx_dir = MODELS_DIR / os.getenv("SGS_CLASSIFIER", "finetuned_onnx")  # override to compare candidates
    if (onnx_dir / "model.onnx").exists():
        try:
            return OnnxClassifier(onnx_dir)
        except Exception as e:  # missing runtime or a bad file: fall back rather than break the call
            print(f"fine-tuned model unavailable ({e}); using baseline")
    path = MODELS_DIR / "baseline.joblib"
    if path.exists():
        return SklearnClassifier(path)
    return KeywordClassifier()
