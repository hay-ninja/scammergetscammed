"""Pull bank details and caller intel out of speech-to-text transcripts.

Speech-to-text writes numbers many ways ("four four one zero", "4410",
"double four"), so we normalize everything to digit runs first.
"""
import re

WORD_DIGITS = {"zero": "0", "oh": "0", "o": "0", "one": "1", "two": "2", "to": None, "too": None,
               "three": "3", "four": "4", "for": None, "five": "5", "six": "6", "seven": "7",
               "eight": "8", "nine": "9"}
# Words that may sit between digits without ending a number ("4, uh, 4").
GLUE = {"uh", "um", "dash"}


def aba_valid(routing: str) -> bool:
    if not re.fullmatch(r"\d{9}", routing):
        return False
    d = [int(c) for c in routing]
    return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 == 0


def _tokens(text: str) -> list[str]:
    text = text.lower().replace("-", " ").replace(",", " ").replace(".", " ")
    return re.findall(r"[a-z]+|\d+", text)


def digit_runs(text: str) -> list[dict]:
    """Return runs of digits with the words just before each run (for context)."""
    toks = _tokens(text)
    runs, cur, start, i = [], "", 0, 0
    while i < len(toks):
        t = toks[i]
        digit = None
        if t.isdigit():
            digit = t
        elif t in ("double", "triple") and i + 1 < len(toks):
            nxt = toks[i + 1]
            d = nxt if nxt.isdigit() and len(nxt) == 1 else WORD_DIGITS.get(nxt)
            if d:
                digit = d * (2 if t == "double" else 3)
                i += 1
        elif WORD_DIGITS.get(t):
            # "oh"/"o" only count as zero next to other digits.
            if t in ("oh", "o") and not cur:
                digit = None
            else:
                digit = WORD_DIGITS[t]
        if digit is not None:
            if not cur:
                start = i
            cur += digit
        elif cur and t in GLUE:
            pass
        elif cur:
            runs.append({"digits": cur, "before": " ".join(toks[max(0, start - 6):start])})
            cur = ""
        i += 1
    if cur:
        runs.append({"digits": cur, "before": " ".join(toks[max(0, start - 6):start])})
    return runs


def _last_label(before: str) -> str | None:
    """Which of "routing" / "account" was said most recently before a number."""
    words = before.split()
    for w in reversed(words):
        if w in ("routing", "account", "acct"):
            return "routing" if w == "routing" else "account"
    return None


PHONE_WORDS = ("call", "phone", "callback", "reach", "line", "extension")
AGENCIES = ["federal reserve", "social security", "irs", "medicare", "fbi", "ftc", "treasury",
            "homeland security", "microsoft", "apple", "amazon", "fraud department", "bank security"]


def extract(text: str) -> dict:
    """Find routing numbers, account numbers and intel in one utterance."""
    lower = text.lower()
    out = {"routing": [], "accounts": [], "intel": {}}
    for run in digit_runs(text):
        d, before = run["digits"], run["before"]
        if 15 <= len(d) <= 21 and "badge" not in before:
            # A routing number and an account read back in one breath ("five seven two ... two eight seven").
            out["routing"].append(d[:9])  # kept even with a bad checksum, so the gate can show the ✗
            out["accounts"].append(d[9:])
            continue
        if "badge" in before or "id" in before.split():
            out["intel"]["badge"] = d
        elif any(w in before for w in PHONE_WORDS) or len(d) in (7, 10, 11):
            out["intel"]["callback"] = d
        elif len(d) == 9 and aba_valid(d):
            out["routing"].append(d)
        elif len(d) == 9 and "routing" in before:
            out["routing"].append(d)  # invalid checksum: kept so we can show the ✗
        elif _last_label(before) == "routing":
            continue  # part of a routing number still being read out, not an account
        elif 8 <= len(d) <= 17:  # shorter runs are usually a number still being read out
            out["accounts"].append(d)
    # Badges like "FR-20417", spoken as "f r 2 0 4 1 7".
    m = re.search(r"badge(?: number)?(?: is)?\s*((?:[a-z][\s-]?){1,3})((?:\d[\s-]?){3,})", lower)
    if m:
        letters = re.sub(r"[\s-]", "", m.group(1)).upper()
        digits = re.sub(r"[\s-]", "", m.group(2))
        out["intel"]["badge"] = f"{letters}-{digits}"
    m = re.search(r"(?:my name is|this is|i am|i'm)\s+(?:agent|officer|detective|special agent)?\s*([a-z]+(?: [a-z]+)?)", lower)
    if m:
        stop = {"calling", "from", "with", "here", "at", "the", "a", "your", "and", "on", "in"}
        words = [w for w in m.group(1).split() if w not in stop]
        words = words[:1] if len(words) < len(m.group(1).split()) else words
        if words and words[0] not in stop:
            out["intel"]["name"] = " ".join(words).title()
    for a in AGENCIES:
        if a in lower:
            out["intel"]["agency"] = a.title() if a not in ("irs", "fbi", "ftc") else a.upper()
            break
    return out
