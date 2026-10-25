# ScammersGetScammed

**A bank fraud-ops tool that turns scam calls into blocked mule accounts.**

Phantom-hacker scams have taken over $1B from seniors, and every one ends the same way: *"move your money to a safe account."* Margaret is an AI decoy grandma who answers scam calls for a bank, CalHacks Federal Credit Union (fictional). She plays along until the scammer reads out their "safe account." Within seconds that account is blocklisted, pending transfers to it are held, and past victims are found for recovery.

**The AI that talks can't block anyone.** Blocking needs three things to agree: a separately trained scam-stage classifier, fixed rules (scam sequence, routing checksum, allowlist), and, for freezes, a human analyst.

## How it works

```
Phone call (Twilio) → Pipecat: Cartesia speech-to-text → Gemini (Margaret) → Cartesia voice
                         │ each caller line
                         ▼
               MargaretSGS: trained classifier + number extractor + gate
                         │ when the gate passes
                         ▼
               Bank controls: blocklist · hold pending wires · 30-day lookback · SAR draft · analyst approval
                         │
                         ▼
               Live dashboard (React) on the projector
```

## Run it

```bash
py -3.13 -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
cd web && npm install && cd ..
cp .env.example .env   # fill in keys
.venv/Scripts/python -m uvicorn server.main:app --port 8000   # dashboard + bank + MargaretSGS
npm --prefix web run dev                                       # dashboard UI on :5173
.venv/Scripts/python scripts/sim_call.py                       # play a scripted call, no phone needed
```

Phone mode: see `server/voice_bot.py`.

## Training

```bash
.venv/Scripts/python training/gen_data.py --calls 2000 --budget 25              # synthetic calls via Claude
.venv/Scripts/python training/gen_data.py --set extra --calls 560 --budget 8    # hard negatives + stalling-senior calls
.venv/Scripts/python training/gen_data.py --set heldout --calls 200 --budget 4 --model claude-sonnet-5-5   # separate test set
.venv/Scripts/python training/train_baseline.py                                 # TF-IDF + logistic regression
# On the GPU box: train_transformer.py, then export_onnx.py; copy training/models/finetuned_onnx back.
```

The server loads the best model it finds: `training/models/finetuned_onnx/` (fine-tuned ModernBERT, int8 ONNX, ~80 ms per line on a laptop CPU), else `baseline.joblib`, else keywords. The Model tab shows false-positive blocks on non-scam calls, scam recall, and per-stage F1. The held-out set is written by a different model with a different prompt, so it is a fairer test than the split of the training data.

## Margaret benchmark

```bash
.venv/Scripts/python scripts/bench_margaret.py --n 40
```

Claude plays 30 scammers (5 scams × 6 tactics: standard, calm, aggressive, "are you a bot?", prompt injection, data grab) and 10 real callers. Margaret answers with the live prompt, model and coaching notes, MargaretSGS watches every line, and Claude grades each transcript. Reports minutes wasted, accounts extracted and blocked, leaks, character breaks, false blocks and Gemini first-token latency. Uses a scratch copy of `bank.db`.

## What's real and what's simulated

| Real | Simulated |
|---|---|
| Phone call, speech recognition, Margaret's voice and replies | CalHacks Federal's ledger and members |
| Trained classifier and its held-out evaluation | The scammer (a judge with a script card) |
| Number extraction, routing checksum, gate, holds, lookback, audit log | Training calls (synthetic, modeled on FBI/FTC scam patterns) |
| | Notifying the receiving bank |

## Cartesia features used

- Sonic text-to-speech for Margaret's voice over a live phone line
- Cartesia speech-to-text for the caller

## Responsible use

- No audio is recorded or stored. Transcripts live in memory for the live session only.
- Margaret never shares real personal data and never moves money.
- Stock voice, no voice cloning.
- Holds are reversible. Every freeze needs a human analyst, and owners of accounts that may be unwitting mules get review, not seizure.
- Non-scam callers are recognized, and Margaret ends the call politely.

## Known limitations

- Speech-to-text can mishear digits. Margaret reads every number back to confirm it.
- One call at a time.
- Routing numbers use the unassigned 5x prefix so they can never match a real bank.
