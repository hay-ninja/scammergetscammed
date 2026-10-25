"""Fixed rules that sit next to the trained model.

The one signal that matters most, a request to send money to a "safe" place,
shouldn't depend on the model alone. Legitimate callers never say these.
"""
import re

SAFE_ACCOUNT = re.compile(
    r"(?:safe|protected|secure|holding|government|federal reserve|treasury) (?:federal )?(?:reserve )?account"
    r"|wire (?:your|the|all|all of your) (?:\w+ )?(?:savings|money|funds)"
    r"|(?:transfer|move|send) (?:your|the|all|all of your) (?:\w+ )?(?:savings|money|funds) (?:to|into) (?:a|an|the|this|our)"
    r"|(?:buy|purchase) (?:\w+ )?gift cards?"
    r"|bitcoin (?:atm|machine)"
    # Grandparent scams never say "safe account": the ask is bail, wired today.
    r"|\bbail\b.{0,40}\b(?:wire|wired|send|transfer)\b|\b(?:wire|send|transfer)\b.{0,30}\bbail\b"
    # Refund scams: "we over-refunded you, wire the difference back".
    r"|\b(?:wire|send|transfer|pay)\b.{0,25}\bdifference\b|\b(?:over-?refund|refunded too much)",
    re.I,
)


NEGATION = re.compile(r"\b(?:never|not|don't|dont|won't|wont|no one|nobody)\b", re.I)


def safe_account_request(text: str) -> bool:
    """True for "wire your savings to this protected account", false for "we'd never ask you to wire money"."""
    for m in SAFE_ACCOUNT.finditer(text):
        if not NEGATION.search(text[max(0, m.start() - 40):m.start()]):
            return True
    return False
