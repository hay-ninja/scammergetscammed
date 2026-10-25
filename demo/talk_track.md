# Talk track, video and tech cheat sheet

Every number here comes from the repo (metrics files, logs, the saved CREAO run). If a judge asks "how do you
know", the source is in brackets.

---

## 1. Live demo (target 4 min: 30 s intro, 90 s call, 90 s bank, 30 s tech; then questions)

### Setup before the judges arrive
- Tab 1: `http://127.0.0.1:8000/#/` (hero page). Tab 2: `#/live`. Tab 3: `#/bank/overview`. Not `localhost`.
- `…` → Reset demo. The live page shows the phone number. Phone charged, laptop on charger, hotspot ready.
- Fallback if the phone line fails: `scripts/sim_call.py scripts/judge_script.json` drives the same screens.

### 0:00 Intro + problem (hero page)
> "Hi, I'm Haydn. I built ScammersGetScammed solo. It's a fraud-ops tool a bank plugs in: an AI decoy grandma
> named Margaret answers scam calls, gets the scammer to read out the account they want the money sent to, and
> the bank blocks that account before a real customer can send money to it."

> "Why: Americans over 60 lost **$4.9 billion** to fraud in 2024. The scam that got the most money was
> phantom hacker scam: fake tech support, then a fake bank, then a fake federal agent, and every version ends with
> *move your money to a safe account*. The victim sends it themselves, so to the bank's fraud models it looks
> legitimate. **$2.09 billion** was lost by bank transfer alone [FTC]. Banks only see it after the money's gone.
> We go after the scammer instead."

### 0:30 The call (`#/live`)
> "You're the scammer. Call this number on speaker, and read the script on screen. Get her to take down an
> account as fast as you can."

- Judge dials **(832) 934-9457**. Point at the screen, not the phone:
  - "Every line you say, our model labels the scam stage, live: authority, fear, secrecy, *safe account*."
  - "This bar is the scam likelihood. It has to cross the block line before anything can be blocked."
- When the judge reads the numbers:
  - "She reads the number back, digit by digit. When you say 'yes', that's our clean copy. Phone audio mishears digits."
  - "The routing number has a checksum. A misheard number fails it and is never blocked."
- The card turns red, **Scam detected · Take action**:
  > "That's the moment. The account was caught, checked against five rules, and blocked within a second.
  > Margaret never shared a single real detail."

### 2:00 The bank (`#/bank/overview`, click "Take action")
> "This is the bank's own fraud console. Our system is one seat in it, with limited powers."

1. **Withheld payments.** Point at each as it animates:
   > "Dorothy, 81, has an $8,500 wire to that account *pending right now*. It's held before it leaves."
   > "Harold and June already sent $26,000 and $15,000 to it in the last 30 days, so those go to recall."
   > "That's **$X protected** from one phone call." (read the number on screen)
2. **The investigation (CREAO).** Open the investigator panel:
   > "One account is one thread. The investigator is a CREAO agent that reads the bank's whole ledger from
   > Capital One's Nessie API (300 members, 90 days) and follows the money."
   > "It found the ring behind this account: **7 linked mule accounts**, including two brand-new accounts at our
   > own bank that pass money straight through. **$175,150** exposed, **$57,800** still pending and stoppable.
   > And it *cleared* a $185,000 escrow wire as a legitimate home closing." [saved run 375a92a6]
   > "That run took 27 minutes over the full ledger, so you're seeing the one we ran tonight."
3. **Take action.** Click **Approve block** on one linked account → the held/recall rows update →
   **Approve freeze**:
   > "The agent only proposes. A human analyst approves every block and every freeze. It's all in the audit
   > log, and the analyst can also reject with a reason."
4. If there's time: the **seat card**.
   > "The AI that talks to the scammer has no tools at all. It can't block anyone. Blocking needs our trained
   > model, fixed rules and a human to agree."

### 3:30 Tech (`#/how`)
Say the 30-second version from section 3, then take questions.

---

## 2. Video (2:00, required to open with the moment)
Record with OBS at 1920×1080, the live page and bank console, voice-over recorded after.

| Time | Shot | Voice-over |
|---|---|---|
| 0:00–0:12 | `#/live` as the account card turns red → "Scam detected" | "A scammer just read out the account he wanted a grandmother's savings sent to. It's now blocked." |
| 0:12–0:30 | Bank overview reveal: Dorothy HELD, Harold and June recall, $ protected | "Her neighbour's $8,500 wire to that account is held. $41,000 already sent is in recall." |
| 0:30–0:45 | Title card + hero stats | "Seniors lost $4.9 billion to fraud last year. Every phantom hacker scam ends with *move your money to a safe account*." |
| 0:45–1:15 | The call from the start, sped up 1.5×, transcript + stage + score visible | "Margaret is our AI decoy. Our own model reads every line and coaches her to get the account." |
| 1:15–1:35 | CREAO panel: findings, Approve block, Approve freeze | "A CREAO agent investigates the whole ledger behind the account. A human approves every action." |
| 1:35–1:55 | `#/how` | "Twilio, Pipecat, Cartesia voice and hearing, Gemini, a ModernBERT model we fine-tuned on Vultr, CREAO and Nessie." |
| 1:55–2:00 | Logo + "ScammersGetScammed" | "The agent that talks can't block anything. The bank stays in charge." |

---

## 3. Tech cheat sheet (what to say, and the numbers behind it)

### 30-second version
> "Three parts. **Margaret** is the voice: Twilio to Pipecat, Cartesia hears the caller, Gemini writes her reply,
> Cartesia speaks it. **MargaretSGS** is the brain I trained: a ModernBERT model fine-tuned on about 3,000 scam
> and normal calls. It labels every line, tells Margaret what to do next, and decides with fixed rules whether
> an account gets blocked. **The bank side** places holds and recalls, a CREAO agent investigates the full Nessie
> ledger, and a human approves. The voice model has no tools, so it can't block anything."

### The model I trained (MargaretSGS)
Be precise: **I trained the model that reads the scam and makes the decisions. Margaret's voice is Gemini.**
That's by design: the part that talks to the scammer is the part that can be manipulated, so it gets no power.

- **What it does:** for every caller line, it reads that line plus the previous two and outputs 1 of 10 labels.
  - 7 scam stages: intro, authority, fear and urgency, secrecy, remote access, safe-account request, account details.
  - 3 normal ones: small talk, legitimate business, sales.
- **How it makes Margaret better at extracting:** the stage picks her next move. Fear → ask for a badge and
  callback. Safe-account ask → "I have a pen, read it slowly". First account → "the screen shows an error, is
  there another?". It goes to her as a private coaching note she follows but never says aloud.
- **Data:** **2,952 synthetic calls** written by Claude (about **$31** of API credit), turn-by-turn labelled,
  in speech-to-text style (lowercase, fillers, numbers as words) [gen logs]. Scam types: phantom hacker phases 2
  and 3, government impostor, tech support, grandparent bail, bank impostor. Hard negatives that look like
  scams: real bank fraud alerts, charities, title companies and family reading out real account numbers, advisors
  moving money between the customer's own accounts.
- **Training:** `answerdotai/ModernBERT-base`, fine-tuned on a **Vultr NVIDIA A16 GPU**, 3 epochs, learning rate
  3e-5, 192 tokens, class weights. **13,701 training windows.** Then exported to **int8 ONNX** so it runs on a
  laptop CPU [finetuned_metrics.json].
- **Results on our test split:** accuracy **88.5%**, macro F1 **0.89**. Best stages: secrecy 0.95, account
  details 0.93, fear 0.91, safe-account request 0.88.
- **The honest test:** **200 held-out calls** generated separately, in a messier style, never trained on. Macro F1
  **0.80**. The fine-tuned model beats our TF-IDF baseline at catching scam calls there: 65% vs 50% at the
  model's default thresholds.
- **The gate** (the decision): an account is blocked only if **all five** pass:
  1. ≥ 1 pressure tactic heard
  2. a "safe account" was asked for before the number
  3. scam score ≥ 0.90
  4. valid routing checksum
  5. not on the allowlist

  Thresholds tuned on validation calls: **0 false blocks on 1,173 legitimate calls**, and **16 of 17** held-out
  scam calls caught (94%) [gate_tuning.json].
- **Red team:** a benchmark where Claude plays scammers trying prompt injection, "are you a bot?" and data grabs:
  **0 leaks, 0 times she revealed she's an AI, 0 coaching notes read aloud, 100% in character**, and 0 false
  blocks on 26 real callers [bench_margaret.json].
- **Tested on real calls:** my own phone calls are saved as replay tests. One reads the numbers in chunks, one
  mishears a digit and must *not* block, which it doesn't.

### How the talking works (voice pipeline)
1. The judge calls a **Twilio** number. Twilio opens a live audio stream (8 kHz) to my laptop through a fixed
   **ngrok** URL.
2. **Pipecat** runs the real-time pipeline. A voice-activity detector and the **Smart Turn** model decide when the
   caller has finished a sentence. Any real word from the caller interrupts Margaret, but breathing and echo don't.
3. **Cartesia** speech-to-text turns the caller's audio into text.
4. Each line goes to **MargaretSGS**: classify → pull out numbers → run the gate → return her next move.
5. **Gemini 3.5 Flash-Lite** writes her reply (max 120 tokens), with the coaching note attached.
   Reply time is about **0.5 s** median, 0.9 s at the 95th percentile [bench].
6. **Cartesia Sonic** speaks it in a stock "old lady" voice (no voice cloning) back down the phone line.
- **Numbers on a phone line are messy**, so: words become digits ("double four" → 44); a number split across
  several lines is stitched back together; Margaret always reads it back, and a "yes" makes her read-back the
  clean copy; a misheard routing number fails the checksum and is never blocked.

### How CREAO and Nessie fit in
- **Nessie** (Capital One's mock banking API) holds the bank's full ledger: **297 members, about 90 days** of
  payroll, Social Security, bills, card spend, wires and member transfers. The scam story plus a **hidden ring**
  that nothing has flagged yet is planted in it, along with legitimate lookalikes it must not flag.
- **CREAO** runs the "MargaretSGS Investigator" agent. When an account is blocked, our server sends it the case:
  blocked accounts, the transcript with stages, the caller's claims, and the holds and recalls already made.
  The agent reads the Nessie ledger, follows the money, and returns a case file and SAR draft plus structured
  findings: linked mules, victims, members at risk right now, cleared lookalikes, totals.
- **Tonight's run** found all 3 planted hidden accounts, 7 linked mules in total, $175,150 exposed, and cleared
  the $185k escrow wire. It noted two Nessie endpoints failing and worked around them.
- **It only proposes.** Each linked account has an Approve button. When the analyst approves, the bank's normal
  controls run: holds, recalls, receiving-bank notice.
- The **console** reads a local copy of the same story (SQLite) for speed. Same accounts, amounts and dates.

### "Is it highly available?" Be honest
> "Not yet. Tonight it's one laptop handling one call at a time. What's built for reliability: if Gemini rate-limits
> mid-call, StepFun takes over automatically; if the phone line fails, the same pipeline runs from a script; every
> hold is reversible and needs a human to freeze. In production, each call is its own stateless voice worker,
> MargaretSGS is a stateless API, and the bank talks to it through one API and one webhook, so it scales by
> running more workers."

### Likely judge questions
- **"Isn't this entrapment / legal?"** It's the bank's own line, used by the bank's fraud team. We never record
  audio (California needs all-party consent), never share real data, and never move money. Freezes need a human.
- **"What if a real person reads out an account?"** The gate needs a pressure tactic and a safe-account ask first.
  The title-company test reads real wire instructions and isn't blocked; the console shows which checks failed.
- **"How do scammers reach Margaret?"** The bank seeds decoy numbers into the lead lists scammers buy, or a branch
  transfers a suspicious call to her.
- **"Why not let the LLM decide?"** Because the scammer is talking to it. Prompt injection can't block an
  innocent account when the LLM has no tools.
- **"What's real vs simulated?"** Real: the phone call, speech, the voice, the trained model and its tests, the
  gate, holds, the CREAO run on Nessie. Simulated: the bank and its members, the scammer (you), and the training
  calls (synthetic, modelled on FBI/FTC descriptions).
