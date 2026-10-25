"""Generate synthetic scam and non-scam phone calls with Claude, for training the stage classifier.

Usage:
  .venv/Scripts/python training/gen_data.py --calls 2000 --budget 25
  .venv/Scripts/python training/gen_data.py --calls 40 --budget 2      # quick smoke test

Writes training/data/calls.jsonl (one call per line) and stops at the spend cap.
"""
import argparse
import json
import random
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import anthropic
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
OUT = Path(__file__).parent / "data" / "calls.jsonl"

# $ per million tokens (input, output), from the Claude API model table.
PRICES = {"claude-opus-5-5": (4.00, 20.00), "claude-sonnet-5-5": (2.00, 10.00), "claude-haiku-5-5": (0.10, 0.50)}

STAGES = ["intro", "authority", "fear_urgency", "secrecy", "remote_access", "safe_account_request",
          "account_details", "benign_chat", "legit_business", "spam_sales"]

# (type, is_scam, share, what the call is)
SCENARIOS = [
    ("phantom_hacker_gov", True, 0.22, "Phantom-hacker stage 3: a fake Federal Reserve, Treasury, FTC or Homeland Security agent says the senior's money is compromised and must be wired to a 'protected' or 'safe' government account today. Ends with the caller reading routing and account numbers."),
    ("phantom_hacker_bank", True, 0.12, "Phantom-hacker stage 2: a fake bank fraud department says there are unauthorized charges, asks which accounts the senior has and how much is in them, and warns them not to tell anyone at the branch."),
    ("gov_impostor", True, 0.10, "Social Security, IRS or Medicare impostor threatening arrest, benefit suspension or a lawsuit unless payment is made now by wire, gift cards, crypto ATM or cash courier."),
    ("tech_support", True, 0.10, "Fake Microsoft/Apple/Amazon support says the computer is hacked, pushes the senior to install remote-access software, then pivots to a refund or 'protect your money' transfer."),
    ("grandparent", True, 0.08, "Grandparent scam: someone posing as a grandchild (or their lawyer/officer) in jail or an accident needs bail money urgently and secretly, by wire, gift cards or courier."),
    ("real_bank_alert", False, 0.08, "A REAL bank fraud alert. The caller asks the customer to confirm whether recent card charges were theirs, never asks for passwords, PINs or to move money, and suggests calling the number on the back of the card."),
    ("charity", False, 0.05, "A legitimate charity volunteer asks for a donation, accepts no as an answer, offers a website or mailed envelope. No pressure, no secrecy."),
    ("billing_reminder", False, 0.06, "A doctor's office, utility or pharmacy calling about a bill or appointment, telling the person to pay through the official website or at the office."),
    ("advisor_rebalance", False, 0.05, "The customer's own long-time financial advisor discussing moving money between the customer's OWN accounts (e.g. checking to an IRA), calm, with paperwork and no urgency."),
    ("family_call", False, 0.06, "A real grandchild or adult child calling to chat, talk about weekend plans, or ask a small favor, with no money pressure."),
    ("wrong_number", False, 0.04, "A wrong number or misdial that is cleared up politely."),
    ("telemarketer", False, 0.04, "A pushy but legal telemarketer selling an extended car warranty, solar panels or a vacation package. Annoying, but not this kind of fraud, and never asks to move savings."),
]

# Second pass: hard negatives that look scammy on the surface, and scammers facing a stalling, confused senior.
EXTRA_SCENARIOS = [
    ("title_company_wire", False, 0.10, "A REAL title/escrow officer, for a house closing the customer scheduled weeks ago, goes over closing costs and reads out the wire instructions already in the customer's closing packet, then insists the customer confirm them by calling the title company's number printed on their documents before sending. No secrecy, no threats."),
    ("real_bank_wire_check", False, 0.10, "A REAL bank fraud team calls about a large wire the customer started themselves at the branch, asks them to confirm the amount and recipient, says it's fine to hang up and call the number on the card. Never asks to move money anywhere else."),
    ("real_family_need", False, 0.08, "A REAL grandchild calls asking to borrow a modest amount for a car repair or rent. Their parents know, they are happy for grandma to call their mom to check, offer to pay it back, suggest a check or Zelle to their own name. No secrecy, no bail, no gift cards."),
    ("real_agency_callback", False, 0.07, "A REAL Social Security, Medicare or IRS office returning a call the customer made, about an appointment or a form. Calm, no threats, no payment by phone, tells them to use the official website or mail."),
    ("real_tech_help", False, 0.05, "A local computer repair shop or the customer's nephew, whom the customer called first, scheduling a visit or walking them through updating their own computer. Never asks for bank logins or money transfers."),
    ("scam_vs_stalling_senior", True, 0.28, "Any scam type (fake government agent, fake bank fraud department, fake tech support, or grandparent scam) where the callee is Margaret, a sweet, slow, easily confused 80-year-old who mishears things, tells long off-topic stories about her late husband, her cat and her garden, keeps asking the caller to repeat and spell things, and wanders off to find her glasses. The scammer grows impatient, repeats instructions, escalates threats or flattery, and reads out routing and account numbers more than once."),
    ("calm_patient_scam", True, 0.17, "A very calm, warm, patient scammer who spends many turns building trust with small talk and soft authority before slowly introducing the problem, the secrecy, and finally the transfer to a 'safe' account. No shouting; the pressure is gentle."),
    ("bank_impostor_otp", True, 0.15, "A fake bank fraud department using the senior's real bank name and a spoofed caller ID asks them to read back a one-time code, then says their account is compromised and money must move to a new 'secure' account today, and reads out the new account numbers."),
]

# Third pass, aimed at the held-out misses: scams that reach an account but phrase the ask unusually,
# and legitimate calls that read out real account numbers.
TARGETED_SCENARIOS = [
    ("gov_impostor_wire", True, 0.16, "Social Security, IRS, FBI or Medicare impostor who, after threats, says the senior's assets must be 'secured', 'verified', 'parked' or 'held in escrow' and reads out routing and account numbers for a wire. Avoid the words 'safe account'; use varied, official-sounding phrasing."),
    ("grandparent_wire", True, 0.16, "Grandparent scam where a 'grandchild', then a 'lawyer', 'bail bondsman' or 'court clerk', asks for bail, a fine, hospital fees or a settlement by wire, and reads out routing and account numbers. Secrecy from the parents is requested."),
    ("bank_impostor_wire", True, 0.14, "Fake bank fraud department or 'bank investigator' says an employee is stealing, asks the senior to help catch them by moving money to a 'new account', 'mirror account' or 'investigation account', and reads out routing and account numbers."),
    ("tech_support_wire", True, 0.12, "Fake tech support or refund department claims it over-refunded the senior, insists they wire the difference back, and reads out routing and account numbers. Includes remote-access software."),
    ("legit_payee_numbers", False, 0.16, "A REAL contractor, landlord, title company or family member reads out THEIR OWN routing and account numbers so the customer can pay an invoice, rent or closing costs they expected. Calm, no secrecy, encourages checking the paperwork."),
    ("advisor_own_accounts", False, 0.14, "The customer's own financial advisor or bank branch officer reads out the customer's OWN account numbers while helping move money between the customer's own accounts, on a call the customer scheduled."),
    ("real_fraud_followup", False, 0.12, "A REAL bank fraud team follows up on a scam the customer already reported: it explains phantom-hacker scams, says the bank will never ask them to move money, and asks no personal details."),
]

HELDOUT_NOTE = """
This batch is an independent test set. Write it in a different style from typical training examples: more interruptions, mishearings, half-finished sentences, people talking over each other, regional speech, and run-together numbers ("five fifty one oh two"). Use unusual names and amounts."""

SCHEMA = {
    "type": "object",
    "properties": {
        "calls": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "turns": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "speaker": {"type": "string", "enum": ["caller", "callee"]},
                                "text": {"type": "string"},
                                "stage": {"type": "string", "enum": STAGES + ["none"]},
                            },
                            "required": ["speaker", "text", "stage"],
                            "additionalProperties": False,
                        },
                    }
                },
                "required": ["turns"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["calls"],
    "additionalProperties": False,
}

SYSTEM = """You write realistic phone-call transcripts used to train a bank's fraud-detection classifier that protects elderly customers. The data is defensive: it teaches a model to recognize scams and, just as important, to NOT flag legitimate calls.

Rules for every transcript:
- 8 to 16 turns, alternating caller and callee, starting with the caller or callee answering.
- Write like speech-to-text output: mostly lowercase, little punctuation, natural fillers (uh, um, okay), short sentences.
- When numbers are spoken, sometimes write digits ("572109086"), sometimes digit words ("five seven two"), sometimes grouped ("4410 2287").
- Use fictional names, agencies' real names are fine, fictional bank names only. Routing numbers must start with 5. Never use real account numbers.
- Label EVERY caller turn with one stage; label every callee turn "none".
  Scam stages: intro, authority (claims to be an official/company), fear_urgency (threats, deadlines), secrecy (don't tell anyone), remote_access (install software / click link), safe_account_request (move/wire/withdraw money to a "safe" place, gift cards, crypto, courier), account_details (reading out routing/account/wallet details).
  Non-scam stages: benign_chat, legit_business (real business doing normal business, including legitimate payment requests through official channels), spam_sales (legal but pushy sales).
- Vary everything: caller tone (calm and polite scammers too, not only aggressive), callee personality, length, region, names, amounts."""


class Spend:
    def __init__(self, model: str, budget: float):
        self.pin, self.pout = PRICES[model]
        self.budget = budget
        self.total = 0.0
        self.lock = threading.Lock()

    def add(self, usage) -> float:
        cost = (usage.input_tokens * self.pin + usage.output_tokens * self.pout) / 1_000_000
        with self.lock:
            self.total += cost
            return self.total

    def over(self) -> bool:
        return self.total >= self.budget


def generate(client, model: str, scenario: tuple, n: int, seed: int, system: str, tag: str) -> tuple[list[dict], object]:
    kind, is_scam, _, desc = scenario
    rng = random.Random(seed)
    flavor = rng.choice(["the callee is a 70-90 year old widow", "the callee is a retired man, hard of hearing",
                         "the callee is polite but suspicious at first", "the callee is very trusting",
                         "the callee is a busy adult in their 60s", "the callee asks lots of questions"])
    resp = client.messages.create(
        model=model,
        max_tokens=16000,
        system=system,
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content":
                   f"Write {n} different transcripts of this call type: {desc}\n"
                   f"{'This IS a scam.' if is_scam else 'This is NOT a scam.'} Variation hint: {flavor}. Seed {seed}."}],
    )
    if resp.stop_reason == "refusal":
        return [], resp.usage
    text = next((b.text for b in resp.content if b.type == "text"), "")
    try:
        calls = json.loads(text)["calls"]
    except (json.JSONDecodeError, KeyError):
        return [], resp.usage
    out = []
    for i, c in enumerate(calls):
        out.append({"call_id": f"{tag}{kind}-{seed}-{i}", "type": kind, "is_scam": is_scam, "turns": c["turns"]})
    return out, resp.usage


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--calls", type=int, default=2000)
    ap.add_argument("--budget", type=float, default=25.0, help="stop when estimated spend reaches this ($)")
    ap.add_argument("--model", default="claude-opus-5-5", choices=list(PRICES))
    ap.add_argument("--per-request", type=int, default=8)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--set", default="main", choices=["main", "extra", "targeted", "heldout"],
                    help="main: original call types; extra: hard negatives + stalling senior; heldout: separate test file")
    args = ap.parse_args()

    client = anthropic.Anthropic()
    spend = Spend(args.model, args.budget)
    out_path, system, tag = OUT, SYSTEM, ""
    scenarios = {"main": SCENARIOS, "extra": EXTRA_SCENARIOS, "targeted": TARGETED_SCENARIOS}.get(args.set)
    if args.set == "heldout":
        out_path, system, tag = OUT.parent / "heldout.jsonl", SYSTEM + HELDOUT_NOTE, "ho-"
        both = SCENARIOS + EXTRA_SCENARIOS  # every type, equal weight per type
        scenarios = [(k, s, 1 / len(both), d) for k, s, _, d in both]
    out_path.parent.mkdir(parents=True, exist_ok=True)

    jobs = []
    for sc in scenarios:
        n_calls = max(args.per_request, round(args.calls * sc[2]))
        for k in range(0, n_calls, args.per_request):
            jobs.append((sc, min(args.per_request, n_calls - k), random.randint(1, 10**6)))
    random.shuffle(jobs)

    written = 0
    with out_path.open("a", encoding="utf-8") as f, ThreadPoolExecutor(args.workers) as pool:
        futures = {}
        it = iter(jobs)

        def submit_next() -> bool:
            if spend.over():
                return False
            job = next(it, None)
            if job is None:
                return False
            futures[pool.submit(generate, client, args.model, *job, system, tag)] = job
            return True

        for _ in range(args.workers):
            submit_next()
        while futures:
            for fut in as_completed(list(futures)):
                job = futures.pop(fut)
                try:
                    calls, usage = fut.result()
                    total = spend.add(usage)
                except anthropic.RateLimitError:
                    print("rate limited, skipping a batch")
                    calls, total = [], spend.total
                except anthropic.APIStatusError as e:
                    print(f"API error {e.status_code}: {e.message}")
                    calls, total = [], spend.total
                except anthropic.APIConnectionError:
                    print("connection error, skipping a batch")
                    calls, total = [], spend.total
                for c in calls:
                    f.write(json.dumps(c) + "\n")
                f.flush()
                written += len(calls)
                print(f"{written:>5} calls  ${total:6.2f}  last: {job[0][0]} (+{len(calls)})")
                submit_next()
                break
    print(f"Done: {written} calls, about ${spend.total:.2f}. File: {out_path}")


if __name__ == "__main__":
    main()
