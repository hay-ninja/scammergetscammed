# ScammersGetScammed

**An AI decoy grandma answers scam calls, gets the scammer to read out his "safe account", and the bank stops
that account before any real customer's money reaches it.**

Live: **https://scammergetscammed.biz** · Call Margaret: **(832) 934-9457** · Solo build, Cal Hacks 13.0

Americans over 60 lost **$4.9 billion** to fraud in 2024 (FBI IC3). The phantom hacker scam always ends the same
way: *"move your money to a safe account."* The victim sends the money themselves, so the bank sees a normal
payment. But the scammer has to say **where** the money goes. We make him say it to us.

**Seats it fills:** Fraud Intelligence Analyst + Payments Controls Officer for CalHacks Federal Credit Union
(a fictional bank).

---

## How it works (one call, end to end)

```
Scammer's phone ─▶ Twilio ─▶ Pipecat ─▶ Cartesia speech-to-text ─▶ caller line
                                                                     │
        Margaret (Gemini, StepFun backup) ◀── coaching note ── MargaretSGS: our fine-tuned model
        │                                                        labels the scam stage, pulls out
        ▼                                                        numbers, runs 5 checks
   Cartesia Sonic voice ─▶ back to the phone                         │ all 5 pass
                                                                     ▼
                      CalHacks Federal (ledger in Capital One Nessie): flag the account,
                      hold pending wires to it, recall the last 30 days, audit log
                                                                     │
                      MargaretSGS Investigator (CREAO agent): reads the full Nessie ledger,
                      finds the ring behind the account, drafts the SAR
                                                                     │
                                         Human analyst approves blocks and freezes
```

**The AI that talks can't flag anyone.** Margaret (the LLM) has no tools. An account is flagged only if all five
checks pass: a pressure tactic was heard · a "safe account" was asked for first · scam score ≥ 0.90 · the
routing number passes the ABA checksum · it's not on the allowlist. Freezes need a human.

## MargaretSGS: the model behind Margaret

- **Data:** 2,952 synthetic calls written by Claude (~$31 of credits), every caller line labelled with its scam
  stage, in phone speech-to-text style. Includes hard negatives: real bank alerts, charities, title companies and
  family members reading out real account numbers.
- **Model:** `answerdotai/ModernBERT-base`, fine-tuned on a **Vultr NVIDIA A16** GPU (3 epochs, 13,701 training
  windows of "this line + the two before it", class weights), exported to int8 ONNX to run on a laptop CPU.
- **10 labels:** intro, authority, fear & urgency, secrecy, remote access, safe-account request, account details,
  small talk, legitimate business, sales.
- **What it does live:** labels every caller line, turns the stage into a private coaching note for Margaret
  (what to ask next), and feeds the 5-check gate.

## Proof (what's real, what's simulated, how we know)

| Test | Result | Source |
|---|---|---|
| Stage accuracy, test split | 88.5% (macro F1 0.89) | `training/models/finetuned_metrics.json` |
| 200 held-out calls, written separately in a messier style | macro F1 0.80 | same |
| False flags on legitimate calls | **0 of 1,173** | `training/models/gate_tuning.json` |
| Held-out scam calls caught | **16 of 17** | same |
| Red team: Claude-played scammers (prompt injection, "are you a bot?", data grabs) | 0 leaks, 0 AI reveals, 100% in character, 0 false flags on 26 real callers | `training/models/bench_margaret.json` |
| Real phone calls replayed as regression tests (incl. a misheard digit that must not be flagged) | all pass | `scripts/replay_call.py` |

| Real | Simulated |
|---|---|
| The phone call, speech recognition, Margaret's voice and replies | CalHacks Federal and its members (synthetic, hosted in Capital One's Nessie) |
| The trained model and its held-out tests | The scammer (a judge with a script) |
| Number extraction, checksum, 5-check gate, holds, recalls, audit log | Training calls (synthetic, modelled on FBI/FTC scam descriptions) |
| CREAO investigations over the Nessie ledger | Notifying the receiving bank |

## CREAO: MargaretSGS Investigator

- **Agent ID:** `5c773c9c-10be-44d7-b636-3bfa5c6829c4`
- **Agent share link:** https://agent.creao.ai/install/5c773c9c-10be-44d7-b636-3bfa5c6829c4?version=7241417b-b073-432d-bca7-eefbf2552e0e
- **Latest run:** `e696c8f0-b4ef-4217-b589-1a920e789fa6` (5 linked mule accounts, $100,850 exposed)
- When an account is flagged, our backend starts the agent via the **API Trigger** with the case: flagged accounts,
  the transcript with stages, the caller's claims, and the holds and recalls already made (`server/creao.py`).
- The agent reads the bank's full ledger from **Nessie**, follows the money, and returns a case file plus
  structured findings: linked mule accounts, more victims, members at risk, legitimate lookalikes it cleared,
  totals, a SAR draft and receiving-bank notices.
- Runs take minutes, so they're async: we poll (and accept webhooks), show progress in the console, and keep the
  last completed run on screen. **The agent only proposes**; each finding has an Approve button, and approval runs
  the bank's normal controls (holds, recalls, notices).
- Without the agent, the bank knows about one account. The agent is what finds the ring.

## Capital One Nessie: the bank's core ledger

- 295 members, 447 checking and savings accounts, ~10,700 transactions over 90 days (payroll, Social Security,
  bills, card spend, member transfers, scam wires), plus a hidden mule ring and legitimate lookalikes.
- `scripts/seed_nessie.py` loads it; `python -m server.bank.nessie` snapshots it; the console's ledger is rebuilt
  from that snapshot on every reset.
- **Write-back:** flagged or frozen CalHacks Federal accounts are marked `HELD_REVIEW` / `FROZEN` in Nessie
  (`PUT /accounts/{id}`). Payment holds are kept on our side because Nessie doesn't allow editing withdrawals.

## Cartesia features used

- **Cartesia speech-to-text** for the caller, streamed over an 8 kHz phone line.
- **Cartesia Sonic** text-to-speech for Margaret, a stock elderly voice (no cloning), with markdown stripped so
  digits are read cleanly.
- Natural turn-taking through Pipecat: Smart Turn end-of-turn detection, interruptions by real words only, and
  Margaret reads every number back digit by digit before it counts.

## Integration (how a bank plugs it in)

- `POST /api/v1/calls`, `POST /api/v1/calls/{id}/lines`, `POST /api/v1/calls/{id}/end`: stream caller lines from
  the bank's own call platform and get the stage, score and coaching back.
- `GET /api/v1/blocklist`: screen payments against flagged accounts.
- Webhook `mule_account.blocked` with the accounts, gate checks, holds and recalls (`WEBHOOK_URL`).
- Keys stay server-side (`SGS_API_KEY`); nothing secret is in this repo.

## Run it

```bash
py -3.13 -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
npm --prefix web install && npm --prefix web run build
cp .env.example .env                                          # Twilio, Cartesia, Gemini, Anthropic, CREAO, Nessie keys
.venv/Scripts/python -m uvicorn server.main:app --port 8000   # site, bank console, MargaretSGS
PYTHONUTF8=1 .venv/Scripts/python server/voice_bot.py -t twilio -x <public-domain>   # Margaret on the phone
.venv/Scripts/python scripts/sim_call.py scripts/judge_script.json                  # no phone? scripted call
.venv/Scripts/python scripts/replay_call.py                                         # regression tests
```

Pages: `/#/` product · `/#/live` Margaret Live · `/#/bank/overview` CalHacks Federal console · `/#/how` architecture.
Deploy to a Vultr server with Caddy (HTTPS) + systemd: `bash deploy/push.sh`.

Training: `training/gen_data.py` (Claude data) → `training/train_transformer.py` (GPU) → `training/export_onnx.py`
→ `training/tune_gate.py`. Benchmark: `scripts/bench_margaret.py`.

## Responsible use

- No audio is recorded or stored. Transcripts live in memory for the call only.
- Margaret never shares real personal data and never moves money.
- Stock voice, no voice cloning.
- Holds are reversible. Every freeze needs a human, and owners of possibly unwitting mule accounts get review,
  not seizure.
- Legitimate callers are recognised and Margaret ends the call politely.

## Known limitations

- One call at a time, on one server. Not yet highly available.
- Phone speech-to-text mishears digits; Margaret reads numbers back, and a misheard routing number fails the
  checksum and is never flagged.
- The model is trained and tested on synthetic calls; real bank call data would be the next step.
- A full CREAO investigation takes minutes, so the console shows the latest completed run while a new one runs.
- Routing numbers use the unassigned 5x prefix, so they can never match a real bank.
