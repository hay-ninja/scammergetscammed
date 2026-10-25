# Scammer Gets Scammed: PRD

**Cal Hacks 13.0, solo build. Submission deadline: Sun Oct 25, 8:50 AM PT (we submit by 8:00 AM).**
**Guiding rule: a working demo beats clean code. Each milestone ends in something that can be demoed.**

---

## 1. One-liner and the outcome

**Pitch:** A fraud-ops tool for a bank. An AI "grandma" answers scam calls, plays along until the scammer gives the "safe account" they want the money sent to, and that account is blocked before any real customer can send money to it.

**The outcome:** every scam call becomes a blocked mule account, plus a list of past victims to recover money for.
A mule account is an account that receives and moves stolen money.

**Hyphenate seat line:** *"Fraud Intelligence Analyst and Payments Controls Officer for Bay Federal Credit Union."*

**Why it's novel:** banks score transactions after a customer has already been scammed. We go upstream: we take the scammer's call, take their accounts, and use them to protect every other customer. Apate (Australia, 2026) proves decoy agents work. No one has wired decoy intel straight into a bank's payment controls with a human-approved audit trail.

---

## 2. Demo story (the only thing that matters)

**Scam:** "Phantom hacker", final stage (FBI: $1B+ lost since 2024, mostly seniors).
Stage 1 is fake tech support. Stage 2 is a fake bank fraud department. Stage 3 is a fake government agent who says "move your money to a safe account." We demo stage 3 live.

**Cast:**
- **Margaret Wilson, 78.** A decoy persona run by Bay Federal Credit Union (fictional). Retired school librarian in Daly City, widow, has a cat named Biscuit, wears a hearing aid, slow and polite.
- **"Agent Daniel Miller, Federal Reserve Asset Protection".** Played by the judge from a script card.
- **Dorothy Park, 81.** A real-seeming Bay Federal customer, currently being scammed by the same ring. She has a pending $8,500 wire to mule account #1.

### 3-minute live script

| t | What happens | Screen |
|---|---|---|
| 0:00 | Hook slide: "Phantom hacker scams took over $1B from seniors. Every one ends with: *move your money to a safe account.*" | Big number |
| 0:15 | "This is Margaret. She's not real. Call her." Judge dials the number on screen (phone on speaker). | Phone number shown huge, status "Waiting for call" |
| 0:25 | Margaret answers: "Hello? Is this about my computer?" Judge reads the card: compromised accounts, urgent, don't tell the bank. | Live transcript; stage tracker lights *Authority → Fear → Secrecy* |
| 1:15 | Margaret stalls and pulls out intel: "What was your badge number, dear? And a number to call you back?" | Intel card fills: name, agency, badge, callback number |
| 1:40 | Judge: "Wire your savings to this protected account: routing …, account …" | Stage: **Safe-account request** (red) |
| 1:50 | Margaret reads the digits back slowly: "Four… four… one… zero, is that right?" | Account card appears: routing checksum ✓, bank looked up, model confidence 0.99 |
| 2:05 | Margaret: "Oh dear, the screen says it didn't go through. Is there another account?" Judge reads account #2. | Second account card |
| 2:20 | **THE MOMENT.** Both accounts go on the blocklist. Dorothy's pending $8,500 wire flips to **HELD**. The lookback finds 2 past customers who sent $41,000 to these accounts, and recall requests start. The suspicious activity report draft is ready. | Impact panel animates red → green |
| 2:40 | Margaret: "My son just got here, I'll call you back." She hangs up. | Summary: call 2:41 · 2 mule accounts · $49,500 protected · 0 real customer data shared |
| 2:50 | Analyst clicks **Approve freeze** (a human is in the loop). Flash the Model tab: trained classifier, zero false positives on 300 non-scam test calls. | Audit log line |

**Video (submission):** opens with THE MOMENT (2:20 above), then rewinds to the call. Hyphenate requires the moment first; Cartesia wants a 2-minute demo-first video.

**Curveball handling (Hyphenate may improvise):**
- If the judge goes off-script, Margaret still plays along (LLM).
- If the judge gives their own account numbers, they still get extracted and blocklisted honestly. The lookback finds nothing, and the UI says so.
- If the judge plays a legitimate caller (wrong number, real bank, charity), no block happens and Margaret ends the call politely. This proves there are no false positives live.

---

## 3. Prize targets

| Prize | Why we fit | Extra work |
|---|---|---|
| **Cartesia** (core) | Voice is the product: Sonic TTS plus Cartesia speech-to-text, live on a phone line | none |
| **Hyphenate** ($8k/5k/3k) | Autonomous fraud-ops seat, limited permissions, audit trail, human approver, test set with answer key, THE MOMENT | Audit log and approve button (in plan) |
| **Best Solo Hack** | Solo | none |
| **MLH Best Use of Gemini API** | Gemini Flash runs Margaret's brain live | none |
| **MLH Best Use of Vultr** | Classifier fine-tuned on a Vultr cloud GPU | Training job (M4) |
| **Anthropic** | Claude generates the training data and drafts the suspicious activity report. Named community: *seniors banking at small credit unions targeted by phantom-hacker scams* | SAR drafter (M5) |
| **Cal Hacks People-First / Most Creative** | Automatic consideration | none |
| Capital One Nessie (optional) | Nessie as the bank ledger | ~2h, only if ahead Sunday |
| .Tech domain (optional) | `scammergetsscammed.tech` | 10 min |

---

## 4. System architecture

```
Judge's phone
   │  (PSTN)
Twilio number ──► POST /twiml  ──► <Connect><Stream url="wss://<ngrok>/ws/twilio">
                                        │  8 kHz mu-law audio, both directions
                                        ▼
┌──────────────────────── FastAPI server (laptop) ─────────────────────────┐
│ Pipecat pipeline                                                          │
│  Twilio transport ─► Silero VAD ─► Cartesia STT ─► user context           │
│        ▲                                   │                              │
│        │                         ScamWatch processor ──────► Event bus    │
│        │                          • classifier (stage + scam prob)  │     │
│        │                          • digit extractor + ABA checksum  │     │
│        │                          • gate (sequence + confidence)    │     │
│        │                          • strategy hint → system message  │     │
│        │                                   ▼                         │     │
│  Cartesia TTS (Sonic) ◄── Gemini Flash (Margaret persona)            │     │
│                                                                      ▼     │
│ Bank engine (SQLite): blocklist, holds, lookback, cases, audit ◄──────┤     │
│ SAR drafter (Claude, async) ◄─────────────────────────────────────────┤     │
│ /ws/dashboard ◄───────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────┘
                                        │
                              React dashboard (projector)
```

**Key design choice (say it to judges):** the talking agent (Gemini) has **no power to block anything**.
Blocking only happens when three things agree: the separately trained classifier, deterministic rules (checksum, allowlist, required sequence), and, for freezes, a human.
So a prompt-injected or hallucinating LLM can't blacklist an innocent account. This is Hyphenate's "limited access" criterion in practice.

---

## 5. Stack (approved)

| Layer | Choice | Notes |
|---|---|---|
| Phone | Twilio (upgraded, ~$20) | Removes the trial message. Buy one local number. |
| Tunnel | ngrok, **free static domain** | The Twilio webhook URL never changes between restarts |
| Voice framework | Pipecat (Python), **pin the version** | Start from Pipecat's Twilio websocket example |
| STT | Cartesia STT via Pipecat | Verify in M1. Fallback: Deepgram (needs your OK) |
| TTS | Cartesia Sonic | Elderly female voice, speed slightly slow |
| Live LLM | Gemini Flash (free tier) | Fast, cheap; adds the MLH prize |
| Training data and SAR | Claude ($50 credits) | Haiku for bulk data, Sonnet for seeds and hard negatives |
| Classifier | scikit-learn baseline + fine-tuned small transformer (ModernBERT-base, fallback DistilBERT) | Trained on Vultr GPU; CPU inference on laptop (~30 ms) |
| GPU | Vultr Cloud GPU (MLH credits) | Training only, not serving |
| Backend | FastAPI + SQLite | Same process as Pipecat |
| Frontend | React + Vite + Tailwind | One page, projector-friendly |

Nothing else gets added without asking.

---

## 6. Components (detailed)

### 6.1 Phone loop (M1)
- `POST /twiml` returns TwiML: `<Connect><Stream url="wss://DOMAIN/ws/twilio"/></Connect>`.
- `/ws/twilio`: Pipecat `FastAPIWebsocketTransport` + `TwilioFrameSerializer` (needs the Twilio SID and token for clean hang-up).
- **Pickup speed:** Margaret's first line is pre-generated audio, played the instant the stream starts. Don't wait on the LLM for "Hello?".
- One call at a time. If a second call arrives while one is active, Margaret says "I'm on the other line" and hangs up.

### 6.2 Latency (the conversation must feel quick)
Target: **≤1.2 s** from the caller stopping to Margaret's first sound.
1. **End-of-speech:** Silero VAD `stop_secs≈0.3` (default ~0.8). This is the biggest win. Try Pipecat smart-turn if people get cut off.
2. **Instant filler:** pre-generated Cartesia clips ("mm-hmm", "oh dear", "hold on, dear", "let me find my glasses"). If no LLM audio arrives within 450 ms of end-of-speech, play one at random. Never two in a row.
3. **Streaming everywhere:** STT partials, LLM tokens sent to TTS sentence by sentence (Pipecat default).
4. **Short replies:** max 2 sentences, `max_output_tokens≈80`, compact system prompt, last ~12 turns of history only.
5. **Interruptions on** (the caller can talk over Margaret).
6. **Warm-up on boot:** open Cartesia and Gemini connections, load the classifier, run one dummy inference.
7. Log per-turn latency (VAD end, STT final, LLM first token, TTS first byte) to the dashboard's debug strip.

### 6.3 Margaret persona (Gemini system prompt, sketch)
```
You are Margaret Wilson, 78, retired librarian in Daly City. Widow. Cat named Biscuit.
You wear a hearing aid. You're polite, worried, slow, and eager to cooperate.
You are a decoy run by a bank's fraud team. The caller is presumed to be a scammer.

Rules:
- 1–2 short sentences. Sound natural: "oh dear", "hm", small tangents about Biscuit.
- Never give real personal data. If pushed, use only DECOY_PROFILE values or stall.
- Never agree that money has been sent. Stall: finding glasses, the slow computer, the bank app.
- Collect intel naturally: caller's name, agency, badge number, callback number, the account to send to.
- When the caller gives numbers, ALWAYS read them back slowly, digit by digit, and ask "is that right?"
- Follow the STRATEGY line below exactly; it changes during the call.
- If the caller seems to be a real, non-scam caller, apologize and end the call politely.
STRATEGY: {strategy}
DECOY_PROFILE: {fake name, fake last-4, fake bank "Bay Federal"}
```
**Strategy hints** (injected by ScamWatch based on the classifier's stage):

| Detected stage | Strategy line |
|---|---|
| intro / authority | "Be confused and impressed. Ask who they are and which agency." |
| fear / urgency | "Get scared. Ask for their badge number and a callback number." |
| secrecy / isolation | "Agree not to tell anyone. Ask what you should do." |
| safe_account_request | "Say you're ready. Ask them to read the routing and account number very slowly." |
| account_given (1st) | "Read it back. Then say the screen shows an error and ask if there's another account." |
| account_given (2nd) | "Read it back. Then say your son just arrived and you'll call back. Say goodbye." |
| not_scam (high confidence) | "Politely say you think they have the wrong number and say goodbye." |

### 6.4 ScamWatch (the trained-model part)
Runs on each **final** caller transcript.
- **Input:** a rolling window, the current caller utterance plus the previous 2 caller utterances, joined with `[SEP]`.
- **Classifier output:** stage label probabilities.
  - Scam stages: `intro`, `authority`, `fear_urgency`, `secrecy`, `remote_access`, `safe_account_request`, `account_details`.
  - Benign stages: `benign_chat`, `legit_business`, `spam_sales`.
- **Call-level scam score:** exponential moving average of P(scam stages), weighted toward money stages.
- **Extractor (deterministic):**
  - Normalize STT text: "four four one zero" → `4410`, "double four" → `44`, "oh" → `0` when it's next to digits, strip punctuation.
  - Routing: 9 digits with a valid **ABA checksum**: `3(d1+d4+d7) + 7(d2+d5+d8) + (d3+d6+d9) ≡ 0 (mod 10)`.
  - Account: 6–17 digits near the words "account" or "acct".
  - Also capture: claimed name, agency, badge number, callback number (regex plus the LLM's read-back confirmation).
  - Bank name comes from a small fictional routing-number lookup table.
- **Gate (all must be true to blocklist):**
  1. The call has passed through **≥2 pressure stages** (authority, fear_urgency, secrecy, remote_access).
  2. `safe_account_request` was detected before the account was given.
  3. Call-level scam score **≥ 0.95**.
  4. The routing checksum is valid, and the account isn't on the **allowlist** (known merchants, exchanges, government treasury accounts).
  5. Otherwise the account is logged as `observed`, not `blocked`.
- **Every decision writes an audit row:** inputs, scores, rule results, and the outcome.

### 6.5 Bank engine (SQLite)
**Tables:**
- `customers`: id, name, age, risk_flags.
- `accounts`: id, customer_id or null, routing, number, bank_name, status: `active | held_review | frozen`.
- `transfers`: id, from_account, to_routing, to_number, amount, status: `pending | completed | held | recall_requested`, created_at.
- `blocklist`: routing, number, source_call_id, status: `provisional | confirmed`, created_at.
- `cases`: id, call_id, intel_json, sar_markdown, status.
- `audit_log`: ts, actor (`scamwatch | rules | analyst | system`), action, details_json.

**When an account passes the gate:**
1. Add it to `blocklist` as `provisional`. Holds are reversible, so they can be automatic.
2. Find `pending` transfers to that account and set them to `held`, then queue a customer warning (UI only). **The customer's own account is never frozen.**
3. Lookback: find `completed` transfers to that account in the last 30 days, set them to `recall_requested`, and list the victims.
4. If the mule account belongs to us, set it to `held_review`. **Freezing requires the analyst's Approve button**, which sets the blocklist row to `confirmed`. This is the segregation-of-duties rule.
5. If it's at another bank, add a "notify receiving bank" action (UI only, labeled as simulated).
6. Kick off the SAR draft (async Claude call) with the call intel, accounts, and amounts. It appears in the case panel when ready.

**Seed (`seed.py`):**
- Margaret's decoy profile and Dorothy with a pending $8,500 wire to mule #1.
- Two past victims: Harold (79), who sent $26,000 to mule #1, and June (83), who sent $15,000 to mule #2.
- About 40 normal customers with normal transfers, so the ledger looks real.
- Mule routing numbers are **generated to pass the checksum** and mapped to fictional banks ("Coastal Harbor Bank", "Pinecrest Savings").
- **`POST /api/reset`** restores the demo state in under 1 s. There's also a reset button on the dashboard, used between judges.

### 6.6 Dashboard (projector-first)
- **Projector rules:** dark theme, huge type (transcript 22px+, numbers 48px+), no scrolling during the demo, readable from 4 m.
- **Header:** "Scammer Gets Scammed · Bay Federal Fraud Ops", the **phone number in big type**, call status, and a call timer.
- **Left column:** live transcript bubbles (Caller vs Margaret). Digits are highlighted, and partials show in grey.
- **Center:** stage tracker stepper (Authority → Fear → Secrecy → Safe-account → Account given), plus a scam-probability bar and the intel card (name, agency, badge, callback).
- **Right:** harvested account cards: routing ✓ checksum, bank, account, status chips (Blocked · Holds · Lookback).
- **Bottom impact strip (THE MOMENT):** Dorothy's wire animates PENDING → **HELD**, the lookback victims, "$49,500 protected", **SAR ready** (opens a modal), and the **Approve freeze** button.
- **End-of-call summary card:** call length, mule accounts harvested, $ protected, real customer data shared = 0.
- **Model tab:** animated loss-curve replay, confusion matrix, baseline vs fine-tuned, false positives on non-scam calls = 0, per-utterance latency.
- **Debug strip** (toggle with `D`): latency per turn.
- **Event types** over `/ws/dashboard` (JSON): `call.started`, `transcript.partial`, `transcript.final`, `stage.update`, `intel.update`, `account.extracted`, `gate.decision`, `bank.hold`, `bank.lookback`, `sar.ready`, `audit.append`, `call.ended`, `latency.turn`.

### 6.7 SAR drafter (Claude)
- A suspicious activity report is the filing banks must make about suspected fraud.
- Input: case intel, the accounts, the held and recalled transfers, and a transcript excerpt (only the caller lines that matter).
- Output: a markdown draft with the standard SAR sections (subject, activity, amounts, narrative). It's clearly labeled **DRAFT, analyst review required**.
- Async: it must never block the call or the moment animation.

### 6.8 Sim harness (dev speed and fallback)
- `scripts/sim_call.py <script.json>` feeds caller utterances as text into ScamWatch, the bank engine and the dashboard. It optionally runs Margaret's replies through Gemini and plays them through Cartesia on the laptop speakers.
- Use it all day for development, so we don't have to dial the phone each time.
- **Fallback if the phone or Wi-Fi fails at judging:** run the sim with the judge's script. Same dashboard, same moment.

---

## 7. Training plan

### 7.1 Synthetic data (Claude)
Start this in the background as early as possible (M2a).

**Scam calls (~1,200):**

| Type | Share |
|---|---|
| Phantom hacker stage 3, government "safe account" | 35% |
| Phantom hacker stage 2, fake bank fraud department | 20% |
| Government impersonator (Social Security, IRS, Medicare) | 15% |
| Tech support | 15% |
| Grandparent emergency | 15% |

Grounded in FBI/FTC descriptions: urgency, secrecy, authority, and payment by wire, crypto ATM, gift cards or courier.

**Non-scam calls (~800). These are the hard negatives, the key to zero false positives:**
- A **real** bank fraud alert. It asks you to confirm recent charges and never asks you to move money.
- A charity donation ask. It asks for money, but there's no "safe account" and no pressure.
- A utility or doctor's billing reminder ("pay through our website").
- A pharmacy refill, a wrong number, or a grandkid genuinely calling.
- An extended-warranty telemarketer (spam, but not this fraud).
- A financial advisor talking about **moving money between your own accounts**. This is the hardest negative.

**Format:** one JSON object per call:
`{call_id, type, is_scam, turns:[{speaker, text, stage}]}`.
Each caller turn gets a stage label.

**Make it sound like speech-to-text output:**
- Lowercase, drop punctuation, numbers sometimes written out as words.
- Filler words ("uh", "um"), occasional dropped words.

**Variety:**
- Rotate caller personas, agency names and dialects.
- Include scammers who stay calm and polite, not only aggressive ones.

**Split by call, not by utterance:** 80/10/10. Also hold out **the judge's script card** as a separate test case.

**Budget:**
- Haiku for bulk, Sonnet for 50 seed calls and the hard negatives.
- Cap spend at **$25**. Check the actual per-token price in the console before running.
- Batch about 10 calls per request.

### 7.2 Models
1. **Baseline (laptop, ~1 min):** TF-IDF on 1–3 word phrases + logistic regression. This is the always-available fallback, and it ships if anything else fails.
2. **Fine-tuned (Vultr GPU, ~15–20 min of training):**
   - ModernBERT-base via HF Transformers `Trainer`, 3 epochs, lr 3e-5, max length 192.
   - Use class weights.
   - Log loss and eval metrics to `train_log.jsonl`.
   - Download the model and the log to the laptop with `scp`.
3. **Call-level decision:** the gate in §6.4, tuned on the validation set so that **false positives on non-scam calls = 0** while scam recall stays as high as possible.

### 7.3 Proof (for Hyphenate: "what's real vs simulated, and how do we know")
- **Test set:** about 200 calls never seen in training, plus the judge's script.
- **Metrics:**
  - Per-stage F1.
  - Call-level scam recall.
  - **False-positive blocks on non-scam calls (target 0).**
  - Extraction accuracy on planted account numbers (with STT-style noise).
  - p50 inference latency.
- **Planted-error test:** 20 calls where the account number is said with digit words, "double", or a correction mid-sentence ("four four, sorry, four five…"), with an answer key.
- **Real:**
  - The phone call, voice AI and speech recognition.
  - Classifier training and inference.
  - Extraction, the gate and the bank control logic.
- **Simulated:**
  - The bank ledger and its customers.
  - The scammer (played by the judge).
  - Training data (synthetic, modeled on FBI/FTC scam patterns).

### 7.4 Training visual for the video
- The Model tab replays `train_log.jsonl` as an animated loss curve over about 5 s.
- It shows a confusion matrix, plus a side-by-side of baseline vs fine-tuned on 5 hard negatives.
- Screen-record it with OBS.

---

## 8. Responsible use (Cartesia scores this; judges will ask)
- **No audio is recorded or stored.** Transcripts live in memory for the live session only. We keep only the extracted account numbers and intel in the case file.
- **The decoy never shares real personal data and never moves money.**
- **No voice cloning.** Margaret is a stock Cartesia voice.
- **A human approves every freeze.** Holds are reversible, and owners of accounts that may be unwitting mules get review and an appeal path. We don't seize anything.
- Non-scam callers are detected, and Margaret ends the call politely.
- **Deployment note in the pitch:** "Operated by banks with carrier partners, under legal review." California requires all-party consent to record calls; we don't record.
- Not legal advice. These are design choices.

---

## 9. Repo layout
```
scammer-gets-scammed/
  server/
    main.py            FastAPI app: /twiml, /ws/twilio, /ws/dashboard, /api/reset, /api/approve
    bot.py             Pipecat pipeline
    persona.py         Margaret prompt, decoy profile, strategy table
    filler.py          pre-generated clips + 450 ms filler logic
    scamwatch/
      classifier.py    loads baseline or fine-tuned model, predicts stages
      extractor.py     digit normalization, ABA checksum, intel regex
      gate.py          blocklist decision + audit
    bank/
      db.py  engine.py  seed.py
    sar.py             Claude SAR drafter
    events.py          async pub/sub → dashboard
  training/
    gen_data.py  augment.py  train_baseline.py  train_transformer.py  eval.py
    data/  models/  train_log.jsonl
  web/                 Vite + React + Tailwind dashboard
  scripts/
    sim_call.py  make_fillers.py  judge_script.json
  demo/
    judge_card.md      printed script for the judge
  .env.example
  README.md
```

**`.env` keys:**
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- `CARTESIA_API_KEY`, `CARTESIA_VOICE_ID`
- `GOOGLE_API_KEY`
- `ANTHROPIC_API_KEY`
- `NGROK_DOMAIN`

---

## 10. Timeline (Sat 3:15 PM → Sun 8:00 AM submit)

| When | Milestone | Done = | Gate |
|---|---|---|---|
| 3:15–4:00 | **M0 Setup** | All keys in `.env`, Twilio number bought, ngrok static domain, Vultr credits requested | — |
| 4:00–6:00 | **M1 Phone loop** | Call the number and have a real conversation with Margaret (Cartesia STT → Gemini → Sonic) | **6:00 PM: if it's not talking, switch STT to the fallback or cut to sim-only** |
| 4:30 (bg) | **M2a Data gen** | `gen_data.py` running in the background with Claude, writing JSONL | Check the first 20 calls by eye at 5:00 |
| 6:00–8:00 | **M2 ScamWatch** | Baseline classifier + extractor + checksum + gate, tested with `sim_call.py` | — |
| 8:00–10:30 | **M3 Bank + dashboard** | Seeded DB, holds and lookback, dashboard showing transcript, stages, accounts and the impact strip | **10:30 PM: full moment works end to end in the sim** |
| 10:30–12:30 | **M4 Fine-tune (Vultr)** | ModernBERT trained, eval run, Model tab | **12:30 AM: ship fine-tuned only if FP = 0 and it beats the baseline; else ship the baseline** |
| 12:30–2:30 | **M5 Smart loop** | Strategy hints, second-account harvest, SAR draft, Approve button, end summary, reset | — |
| 2:30–4:30 | **M6 Polish and rehearse** | Latency tuning, filler clips, 10 full phone rehearsals, fix bugs | **4:30 AM FEATURE FREEZE** |
| 4:30–6:30 | **M7 Ship** | OBS video (moment first), README (setup, Cartesia features, limitations, real vs simulated), Devpost text, judge card printed or on a phone | — |
| 6:30–8:00 | Buffer | Submit by **8:00** | — |
| 10:30 AM | Judging | Charged laptop, hotspot as backup | — |

**Cut order if behind** (cut the top items first):
1. Nessie
2. Filler clips
3. SAR drafter
4. Fine-tuned model (the baseline ships)
5. Second-account harvest
6. The phone itself (sim demo)

**Never cut:** THE MOMENT, the gate and audit log, the reset button.

---

## 11. Risks and mitigations
| Risk | Mitigation |
|---|---|
| STT mangles digits | Margaret reads numbers back; normalizer; ABA checksum; card digits chosen to be easy to say |
| Venue noise triggers VAD on speakerphone | Judge holds the phone close while speaking; test VAD threshold in the hall; fall back to the sim |
| Venue Wi-Fi or Twilio fails | Phone hotspot; sim harness fallback with the same dashboard |
| Gemini free-tier rate limit | One call at a time is fine; keep a Haiku fallback flag in config |
| Pipecat API changes | Pin the version and start from the official Twilio example |
| Vultr GPU unavailable or credits slow | The baseline ships; fine-tuning is a bonus |
| Claude spend | Haiku for bulk, $25 cap, batch 10 calls per request |
| LLM says something unsafe or off-persona | Short replies, strict prompt; the gate means the LLM can't trigger blocks anyway |
| Demo state dirty between judges | One-click reset |

---

## 12. Sponsor and booth checklist (do before heading back to build)
1. **MLH booth:**
   - **Vultr GPU credits.** The coach issues them.
   - Confirm opt-in for **Gemini** and **Vultr** on Devpost.
   - Optional: free **.Tech domain** code.
2. **Hyphenate:**
   - Ask *"Does a bank fraud-ops seat count as a finance-team seat?"* and *"Would a decoy-call-to-payment-controls system fit?"*
   - Get their reaction before investing. Ask what scenario they'd throw at it.
3. **Cartesia:**
   - Confirm the `CARTESIACALHACKS` redemption works.
   - Ask about Pipecat STT support, their recommended elderly female voice ID, and phone-latency tips.
4. **Anthropic:** confirm the prize criteria, and pitch the named community ("seniors at small credit unions targeted by phantom-hacker scams"). Ask whether Claude for data generation and SAR drafting counts as "thoughtful use".
5. **Capital One:** grab a Nessie API key (only for the optional path).
6. **Online, no booth:**
   - Twilio signup and upgrade, then buy a number.
   - ngrok signup and claim the static domain.
   - Gemini key at aistudio.google.com.
   - Anthropic console key.

---

## 13. Judge card (draft, printed)
> **You are "Agent Daniel Miller, Federal Reserve Asset Protection."**
> 1. "Mrs. Wilson, I'm calling from the Federal Reserve. Your accounts were compromised by hackers in a foreign country."
> 2. "You must act today or you'll lose everything. Do **not** tell your bank, because they're involved."
> 3. If asked: badge **FR-20417**, callback **(415) 555-0137**.
> 4. "We've opened a protected Federal Reserve account for you. Wire your savings there."
>    Routing **[generated]** · Account **[generated mule #1]**
> 5. If she says it failed: "Use this backup account." Routing **[generated]** · Account **[mule #2]**
> Feel free to improvise. She'll play along.

---

## 14. Definition of done
- [ ] A judge dials the number, Margaret answers in under 1 s, and the conversation feels natural (about 1.2 s turns).
- [ ] Spoken account numbers are extracted and checksum-validated, and Margaret reads them back.
- [ ] THE MOMENT fires within 2 s of the account being given: blocklist, Dorothy's wire HELD, lookback $41k, $ protected.
- [ ] Analyst Approve button; audit log for every decision.
- [ ] Non-scam caller → no block, and Margaret ends the call politely.
- [ ] Model tab: trained classifier, false positives on non-scam calls = 0, training curve replay.
- [ ] Reset in under 1 s. The sim fallback works with the phone off.
- [ ] Video opens with the moment. README states what's real vs simulated. Submitted by 8:00 AM.
