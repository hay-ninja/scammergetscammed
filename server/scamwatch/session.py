"""One live decoy call: transcript, stages, intel, harvested accounts, and the gate.

The talking LLM never calls into this to block anything. Only caller
transcripts flow in; blocking decisions come from the classifier and rules.
"""
import re
import time
import uuid

from server import config
from server.bank import engine
from server.bank.seed import BAY_FEDERAL
from server.scamwatch import classifier as clf
from server.scamwatch import rules
from server.scamwatch.extractor import WORD_DIGITS, _tokens, aba_valid, digit_runs, extract

_model = clf.load()
CONFIRM = re.compile(r"(?:yes|yeah|yep|yup|correct|right|that's right|thats right|that is right|that's correct|exactly|uh huh)\b")
FILLER_ONLY = re.compile(r"(?:(?:yes|yeah|yep|yup|ok|okay|sure|right|correct|uh|um|mm|hmm|hello|that's right|thats right"
                         r"|got it|do you get it|did you get that)[\s.,?!]*)+")


def model_name() -> str:
    return _model.name


def reload_model() -> str:
    global _model
    _model = clf.load()
    return _model.name


STRATEGY = {
    "start": "Be confused and a little worried. Ask who is calling and why.",
    "authority": "Be impressed and nervous. Ask their name and who they are with.",
    "fear_urgency": "Get scared. Ask them to explain slowly what happened and what you should do. If they claim to be an official, ask for a badge number once.",
    "secrecy": "Agree not to tell anyone. Ask what you should do to keep your money safe.",
    "remote_access": "Say the computer is very slow and you can't find the button. Ask what to do instead.",
    "safe_account_request": "Say you're willing and ask exactly what you should do. Only if they mention an account, say you have a pen and ask them to read it very slowly.",
    "account_1": "Read the account number back once if you haven't. Then say you'll go take care of it right now, thank them warmly, and say goodbye.",
    "account_2": "Read the numbers back digit by digit. Then say your son just arrived and you'll call them back. Say goodbye.",
    "not_scam": "This sounds like a normal, honest caller. Be warm, answer simply, wrap up kindly and say goodbye.",
}


class CallSession:
    def __init__(self, source: str = "sim"):
        self.state = {
            "call": {"id": uuid.uuid4().hex[:8], "status": "active", "source": source,
                     "started_at": time.time(), "ended_at": None},
            "model": _model.name,
            "transcript": [],
            "partial": None,
            "stages_seen": [],
            "current_stage": None,
            "scam_score": 0.0,
            "intel": {},
            "accounts": [],
            "impact": {"holds": [], "lookback": [], "notified": [], "protected_total": 0,
                       "freeze_pending": False, "freeze_approved": False},
            "sar": {"status": "none", "markdown": ""},
            "strategy": STRATEGY["start"],
            "summary": None,
            "audit": [],
            "latency": [],
        }
        self._caller_lines: list[str] = []
        self._no_scam_prob = 1.0
        self._pending_routing: dict | None = None
        self._pending_account: dict | None = None
        self._turn = 0
        self._frags: list[tuple[float, str]] = []
        self._readback: str | None = None

    # ---- inputs -------------------------------------------------------------

    def partial(self, speaker: str, text: str) -> None:
        self.state["partial"] = {"speaker": speaker, "text": text}

    def margaret_said(self, text: str) -> None:
        self.state["partial"] = None
        self.state["transcript"].append({"speaker": "margaret", "text": text.replace("*", ""), "ts": time.time()})
        # Her read-back of a full number; it counts once the caller confirms it ("yes", "that's right").
        rb = extract(text)
        self._readback = text if rb["routing"] or rb["accounts"] else None

    def caller_said(self, text: str, ts: float | None = None) -> list[str]:
        """Process one final caller utterance. Returns event tags (e.g. 'moment')."""
        events: list[str] = []
        self._turn += 1
        self.state["partial"] = None
        self._caller_lines.append(text)
        pred = _model.predict(self._caller_lines[-3:])
        stage = pred["stage"]
        self.state["transcript"].append({"speaker": "caller", "text": text, "ts": time.time(),
                                         "stage": stage, "p_scam": pred["p_scam"]})
        self.state["current_stage"] = stage
        # A stage counts as seen when the model gives it real probability, not only when it's the top pick,
        # so "move your money to this safe account, routing ..." registers both stages.
        for s in clf.SCAM_STAGES:
            if (s == stage or pred["probs"].get(s, 0) >= config.STAGE_SEEN_MIN_PROB) and s not in self.state["stages_seen"]:
                self.state["stages_seen"].append(s)
        if rules.safe_account_request(text) and "safe_account_request" not in self.state["stages_seen"]:
            self.state["stages_seen"].append("safe_account_request")
            self.state["audit"].append(engine.audit("rules", "safe_account_phrase", {"text": text[:120]}))
        if pred["p_scam"] > 0.6:
            self._no_scam_prob *= 1 - 0.5 * pred["p_scam"]
        self.state["scam_score"] = round(1 - self._no_scam_prob, 3)

        self.state["intel"].update(extract(text)["intel"])
        # Phone speech-to-text splits a number across fragments ("routing 572109." "Oh," "8-6."), sometimes
        # with "yes" or Margaret's read-back in between, so numbers are read from the recent caller fragments.
        window = self._number_window(text, ts or time.time())
        found = extract(window)
        # On the phone the caller corrects themselves ("no, cut the first two"), so the clean copy of a number is
        # Margaret's read-back. A confirmed read-back counts as if the caller had said it.
        if self._readback and CONFIRM.match(text.lower().strip()):
            rb = extract(self._readback)
            found["routing"] += [r for r in rb["routing"] if r not in found["routing"]]
            found["accounts"] += [a for a in rb["accounts"] if a not in found["accounts"]]
            window += f" | confirmed read-back: {self._readback}"
        self._readback = None
        if found["routing"] or found["accounts"] or any(ch.isdigit() for ch in text):
            self.state.setdefault("number_log", []).append(
                {"line": text, "window": window[-200:], "routing": found["routing"], "accounts": found["accounts"]})
        confirmed_rb = "confirmed read-back" in window
        for r in found["routing"]:
            if aba_valid(r):
                events += self._bank_identified(r, confirmed_rb)
        paired = {(a["routing"], a["number"]) for a in self.state["accounts"]}
        for r in found["routing"]:
            # Refreshed every time it's heard again, so a routing number read in chunks, repeated and confirmed
            # still pairs with an account that arrives a few lines later.
            self._pending_routing = {"routing": r, "turn": self._turn}
        for a in found["accounts"]:
            if any(a == n or r.startswith(a) for r, n in paired) or any(r.startswith(a) for r in found["routing"]):
                continue  # already captured, or a routing number heard before its last digits arrived
            if not (self._pending_account and self._pending_account["number"] == a):
                self._pending_account = {"number": a, "turn": self._turn,
                                         "after_ask": "safe_account_request" in self.state["stages_seen"]}
        self._pair_accounts()

        # Re-check accounts that only failed on the score threshold.
        for acct in self.state["accounts"]:
            if acct["status"] == "observed" and self._evaluate(acct):
                events.append("moment")
        if any(a.get("_new_block") for a in self.state["accounts"]):
            events.append("moment")
            for a in self.state["accounts"]:
                a.pop("_new_block", None)

        self._update_strategy(pred)
        return events

    def _bank_identified(self, routing: str, confirmed: bool) -> list[str]:
        """First flag of the call: the scammer has named the bank the money should go to (a valid routing number).

        Nothing is blocked yet (a block needs the account too); the console starts the flow from here.
        Fires 'bank_found' once per routing number, and again when Margaret's read-back of it is confirmed.
        """
        hit = self.state.setdefault("banks_identified", [])
        cur = next((b for b in hit if b["routing"] == routing), None)
        if cur and (cur["confirmed"] or not confirmed):
            return []
        if cur:
            cur["confirmed"] = True
        else:
            cur = {"routing": routing, "bank": engine.bank_name(routing), "internal": routing == BAY_FEDERAL,
                   "confirmed": confirmed, "ts": time.time(), "scam_score": self.state["scam_score"],
                   "stages_seen": list(self.state["stages_seen"])}
            hit.append(cur)
        self.state["audit"].append(engine.audit("scamwatch", "bank_identified", {
            "routing": routing, "bank": cur["bank"], "confirmed": cur["confirmed"], "scam_score": self.state["scam_score"]}))
        return ["bank_found"]

    def _number_window(self, text: str, now: float) -> str:
        """The last few caller fragments (within 30 s) joined, minus filler-only ones like "yes" or "okay".

        Fragments are glued with a space while a number is still growing, so "5-5-1" + "204" + "7-1-1"
        reads as 551204711; once a run is 8+ digits a word goes between, so two numbers never merge.
        """
        self._frags = [(t, f) for t, f in self._frags if now - t < 30][-5:]
        if not FILLER_ONLY.fullmatch(text.lower().strip()):
            self._frags.append((now, text))
        joined = ""
        for _, f in self._frags:
            toks = _tokens(joined)
            growing = bool(toks) and (toks[-1].isdigit() or bool(WORD_DIGITS.get(toks[-1])))
            runs = digit_runs(joined)
            if growing and runs and len(runs[-1]["digits"]) >= 8:
                growing = False
            joined += (" " if growing else " next ") + f
        return joined

    # ---- accounts and gate ---------------------------------------------------

    def _pair_accounts(self) -> None:
        r, a = self._pending_routing, self._pending_account
        # 6 caller lines: on the phone an account arrives in pieces plus a read-back confirmation after the routing number.
        if not (r and a) or abs(r["turn"] - a["turn"]) > 6:
            return
        self._pending_routing = self._pending_account = None
        acct = {"routing": r["routing"], "number": a["number"], "bank": engine.bank_name(r["routing"]),
                "checksum_ok": aba_valid(r["routing"]), "after_ask": a["after_ask"],
                "status": "observed", "gate": {}, "result": None}
        if any(x["routing"] == acct["routing"] and x["number"] == acct["number"] for x in self.state["accounts"]):
            return
        self.state["accounts"].append(acct)
        if self._evaluate(acct):
            acct["_new_block"] = True

    def _evaluate(self, acct: dict) -> bool:
        pressure = [s for s in self.state["stages_seen"] if s in clf.PRESSURE_STAGES]
        allow = engine.is_allowlisted(acct["routing"], acct["number"])
        checks = {
            "pressure_stages": len(pressure) >= config.GATE_MIN_PRESSURE_STAGES,
            "asked_for_safe_account_first": acct["after_ask"],
            "scam_score": self.state["scam_score"] >= config.GATE_MIN_SCAM_SCORE,
            "routing_checksum": acct["checksum_ok"],
            "not_allowlisted": allow is None,
        }
        acct["gate"] = checks
        passed = all(checks.values())
        row = engine.audit("scamwatch", "gate_decision", {
            "account": f"{acct['routing']}/{acct['number']}", "checks": checks, "passed": passed,
            "scam_score": self.state["scam_score"], "model": _model.name})
        self.state["audit"].append(row)
        if not passed:
            return False
        acct["status"] = "blocked"
        result = engine.block_account(acct["routing"], acct["number"], self.state["call"]["id"])
        self.state["audit"] += result.pop("audit")
        acct["result"] = result
        imp = self.state["impact"]
        imp["holds"] += result["holds"]
        imp["lookback"] += result["lookback"]
        if result["notify_bank"]:
            imp["notified"].append(result["notify_bank"])
        if result["internal"]:
            imp["freeze_pending"] = True
        imp["protected_total"] = sum(x["amount"] for x in imp["holds"] + imp["lookback"])
        self.state["sar"]["status"] = "pending"
        return True

    def _update_strategy(self, pred: dict) -> None:
        blocked_or_seen = len(self.state["accounts"])
        if pred["stage"] in clf.BENIGN_STAGES and self.state["scam_score"] < 0.3 and self._turn >= 3:
            key = "not_scam"
        elif blocked_or_seen >= 2:
            key = "account_2"
        elif blocked_or_seen == 1:
            key = "account_1"
        elif pred["stage"] in STRATEGY:
            key = pred["stage"]
        else:
            key = "start"
        self.state["strategy"] = STRATEGY[key]

    # ---- analyst and end of call --------------------------------------------

    def approve_freeze(self) -> None:
        frozen = engine.approve_freeze()
        imp = self.state["impact"]
        imp["freeze_pending"] = False
        imp["freeze_approved"] = True
        self.state["audit"].append({"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "actor": "analyst",
                                    "action": "freeze_approved", "details": {"frozen": frozen}})

    def end(self) -> None:
        c = self.state["call"]
        c["status"] = "ended"
        c["ended_at"] = time.time()
        blocked = [a for a in self.state["accounts"] if a["status"] == "blocked"]
        self.state["summary"] = {
            "duration_s": round(c["ended_at"] - c["started_at"]),
            "mule_accounts": len(blocked),
            "protected_total": self.state["impact"]["protected_total"],
            "customers_protected": len({x["customer"] for x in self.state["impact"]["holds"] + self.state["impact"]["lookback"]}),
            "real_data_shared": 0,
        }
