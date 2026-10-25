"""Shared data loading, speech-to-text style noise, splits, and call-level evaluation."""
import json
import random
import re
from pathlib import Path

DATA = Path(__file__).parent / "data" / "calls.jsonl"
HELDOUT = Path(__file__).parent / "data" / "heldout.jsonl"
MODELS = Path(__file__).parent / "models"
SCAM_STAGES = {"intro", "authority", "fear_urgency", "secrecy", "remote_access", "safe_account_request", "account_details"}
PRESSURE = {"authority", "fear_urgency", "secrecy", "remote_access"}
NON_SCAM_DEFAULT = {"family_call": "benign_chat", "wrong_number": "benign_chat", "real_family_need": "benign_chat",
                    "telemarketer": "spam_sales"}
WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]


def load_calls(path: Path = DATA) -> list[dict]:
    calls = []
    if not path.exists():
        return calls
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            c = json.loads(line)
        except json.JSONDecodeError:
            continue
        if any(t["speaker"] == "caller" for t in c.get("turns", [])):
            calls.append(c)
    return calls


def stt_noise(text: str, rng: random.Random) -> str:
    """Make text look like live speech-to-text: lowercase, no punctuation, mixed number styles."""
    t = re.sub(r"[^\w\s']", " ", text.lower())
    if rng.random() < 0.5:
        t = re.sub(r"\d", lambda m: " " + WORDS[int(m.group())] + " ", t)
    elif rng.random() < 0.3:
        t = re.sub(r"(\d)", r"\1 ", t)
    if rng.random() < 0.2:
        words = t.split()
        if len(words) > 4:
            words.pop(rng.randrange(len(words)))
        t = " ".join(words)
    return re.sub(r"\s+", " ", t).strip()


def windows(call: dict, rng: random.Random | None = None) -> list[tuple[str, str]]:
    """(text window of the last 3 caller lines, stage of the newest line) for each caller turn."""
    out, caller_lines = [], []
    for t in call["turns"]:
        if t["speaker"] != "caller":
            continue
        line = stt_noise(t["text"], rng) if rng else t["text"].lower()
        caller_lines.append(line)
        stage = t["stage"]
        if not call["is_scam"] and stage in SCAM_STAGES | {"none"}:  # e.g. a charity's greeting labeled "intro"
            stage = NON_SCAM_DEFAULT.get(call["type"], "legit_business")
        elif stage == "none":
            stage = "intro"
        out.append((" [SEP] ".join(caller_lines[-3:]), stage))
    return out


def split(calls: list[dict], seed: int = 7) -> tuple[list, list, list]:
    """Split by call (never by line) so no call leaks across sets: 80/10/10."""
    rng = random.Random(seed)
    calls = calls[:]
    rng.shuffle(calls)
    n = len(calls)
    return calls[: int(n * 0.8)], calls[int(n * 0.8): int(n * 0.9)], calls[int(n * 0.9):]


def heldout_eval(predict) -> dict | None:
    """Score on the independent test set (different generator model and prompt), if it exists."""
    from sklearn.metrics import accuracy_score, f1_score
    calls = load_calls(HELDOUT)
    if not calls:
        return None
    te = [w for c in calls for w in windows(c)]
    y = [l for _, l in te]
    pred = [predict(t)[0] for t, _ in te]
    return {"n_calls": len(calls), "n_windows": len(te), "accuracy": round(accuracy_score(y, pred), 3),
            "macro_f1": round(f1_score(y, pred, average="macro", zero_division=0), 3),
            "call_level": call_level(calls, predict)}


SEEN_MIN_PROB = 0.3  # a stage counts as "seen" when the model gives it at least this much probability


def call_level(calls: list[dict], predict, score_min: float = 0.95) -> dict:
    """Replay the live gate on each call: would it have blocklisted an account?

    `predict(text)` returns (stage, p_scam, probs). Accounts are found the same
    way as live: by the number extractor, not by the classifier.
    """
    from server.scamwatch.extractor import extract
    from server.scamwatch.rules import safe_account_request

    tp = fp = fn = tn = 0
    false_pos = []
    for c in calls:
        seen, no_scam = set(), 1.0
        flagged = False
        caller_lines = [t["text"] for t in c["turns"] if t["speaker"] == "caller"]
        for (text, _), raw in zip(windows(c), caller_lines):
            stage, p_scam, probs = predict(text)
            seen |= {s for s, p in probs.items() if s in SCAM_STAGES and p >= SEEN_MIN_PROB}
            if safe_account_request(raw):  # same fixed rule as live
                seen.add("safe_account_request")
            if p_scam > 0.6:
                no_scam *= 1 - 0.5 * p_scam
            score = 1 - no_scam
            gave_account = bool(extract(raw)["accounts"]) or stage == "account_details"
            if (gave_account and "safe_account_request" in seen
                    and len(seen & PRESSURE) >= 2 and score >= score_min):
                flagged = True
                break
        # Only calls where the scammer actually reads out a destination account can be blocked.
        scam_with_account = c["is_scam"] and any(extract(t)["accounts"] for t in caller_lines)
        if flagged and not c["is_scam"]:
            fp += 1
            false_pos.append(c["call_id"])
        elif scam_with_account and flagged:
            tp += 1
        elif scam_with_account:
            fn += 1
        elif not c["is_scam"]:
            tn += 1
    scams = tp + fn
    return {"scam_calls_with_account": scams, "caught": tp, "recall": round(tp / scams, 3) if scams else None,
            "non_scam_calls": fp + tn, "false_positive_blocks": fp, "false_positive_ids": false_pos[:10]}
