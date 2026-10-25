# Devpost submission (copy-paste)

## Project name
ScammersGetScammed

## Elevator pitch
An AI decoy grandma answers scam calls, tricks the scammer into revealing his bank account, and lets the bank stop it before real victims pay it.

---

## Inspiration
Americans over 60 lost $4.9 billion to fraud in 2024, about $33,000 per victim (FBI IC3). One of the worst is the
phantom hacker scam. First a fake tech-support agent calls, then a fake bank, then a fake federal agent who says
"move your money to a safe account." The victim sends the money themselves, so the bank sees a normal payment
and only finds out after it's gone.

Every version of this scam has the same weak spot: the scammer has to say where the money goes. I wanted to build
someone for him to say it to.

It's for seniors at small credit unions who get targeted by phantom hacker scams, and for the small fraud teams
trying to protect them.

## What it does
Margaret is a 78-year-old AI decoy who answers scam calls for a bank. For the demo it's a fictional one,
CalHacks Federal Credit Union. She sounds like a slightly confused grandma, keeps the scammer talking, and gets
him to read out the account he wants the money sent to.

While she talks, a model I trained (MargaretSGS) labels every line the scammer says: authority, fear, secrecy,
the "safe account" ask. It tells Margaret what to ask next. When he reads out an account, she reads it back digit
by digit, and five checks run:

1. He used a pressure tactic.
2. He asked for a "safe account" first.
3. The scam score is above 0.90.
4. The routing number passes the bank checksum.
5. The account isn't on the allowlist.

If all five pass, the bank acts in its own fraud console:
- A senior's pending $8,500 wire to that account is held before it leaves.
- Payments sent to it in the last 30 days are recalled.
- A CREAO agent goes through the bank's full ledger in Capital One's Nessie, follows the money, and finds the ring
  behind the account: other mule accounts, other victims, and members whose wires are still pending. It also
  clears legitimate lookalikes, like a large escrow wire for a home purchase.
- An analyst approves each block and freeze, or rejects it with a reason. Every step goes in the audit log.

The AI that talks to the scammer can't flag anyone. It has no tools. Flagging needs my model, fixed rules and,
for freezes, a person. So a scammer who tries to prompt-inject Margaret can't get an innocent account flagged.

The seat it fills: Fraud Intelligence Analyst and Payments Controls Officer.

## How I built it
**Voice.** A Twilio number streams the call audio into a Pipecat pipeline. Cartesia transcribes the scammer,
Gemini 3.5 Flash-Lite writes Margaret's reply, and Cartesia Sonic speaks it in a stock elderly voice. If Gemini
hits a rate limit mid-call, StepFun takes over automatically. Replies start in about half a second.

**The model behind Margaret (MargaretSGS).** I had Claude write 2,952 practice calls for about $31 in credits,
with every caller line labelled by scam stage. About 40% are legitimate calls, many built to look like scams: real bank
alerts, charities, title companies reading out real account numbers. I fine-tuned ModernBERT-base on a Vultr
NVIDIA A16 GPU, using each line plus the two before it, then shrank it to int8 so it runs live on a CPU.

**Getting the numbers right.** Phone transcription turns "five seven two" into three separate lines, and it
mishears digits. I stitch the pieces back together, treat Margaret's confirmed read-back as the clean copy, and
let the routing checksum reject anything misheard.

**The bank.** CalHacks Federal's ledger lives in Nessie: 295 members and about 10,700 transactions. Flagged
accounts are written back to Nessie as held or frozen. A FastAPI backend handles holds, recalls and the audit
log, and exposes an API and a webhook so a bank could connect its own phone system.

**The investigator.** When an account is flagged, my backend starts a CREAO agent through its API Trigger and
sends it the case. The agent reads Nessie and returns a case file, structured findings and a draft suspicious
activity report. Runs take several minutes, so the console shows progress and keeps the last finished run on screen.

**The rest.** React and Tailwind for the two screens (Margaret Live and the bank's fraud console), deployed on a
Vultr server at scammergetscammed.biz.

**Testing.** A red-team benchmark where Claude plays scammers and a second Claude grades Margaret, plus my own
phone calls saved as replay tests.

## Challenges I ran into
- **Numbers over the phone.** Most of my debugging went here: split digits, misheard digits, callers correcting
  themselves halfway through.
- **Natural conversation.** Early on Margaret went silent mid-call (Gemini's free quota ran out) or got cut off by
  breathing and echo. Tuning turn detection and adding a backup model fixed both.
- **Not flagging innocent people.** Real title companies read out account numbers too. The look-alike training
  calls and the five checks got false flags to zero.
- **Slow agents.** A full investigation takes minutes, so the investigator had to run asynchronously, without
  blocking anything.

## Accomplishments that I'm proud of
- Zero false flags on 1,173 legitimate calls, while catching 16 of 17 held-out scam calls.
- It works on a real phone line: you call the number, read out an account, and the bank holds the money seconds later.
- In red-team tests Margaret never leaked data, never admitted she was an AI, and stayed in character.
- The CREAO agent found a hidden mule ring that nothing else had flagged.
- I built all of it solo, over one night.

## What I learned
- The safest place for an LLM is somewhere it has no power. Splitting talking, deciding and acting made the system
  harder to trick, not weaker.
- Synthetic data is cheap, but it only works if it includes the hard cases. The legitimate look-alike calls
  mattered more than the scams.
- Real phone audio breaks things a text demo hides. Saving my own calls as tests caught bugs nothing else did.

## What's next for ScammersGetScammed
- Pilot it with a credit union's fraud team, routing suspicious calls to Margaret.
- Train on real, consented call recordings, and add more scam types and languages.
- Share flagged accounts between banks, so a mule account caught at one bank is stopped at all of them.
- Run each call as its own worker so it can handle many calls at once.

---

## Built with (tags)
python, fastapi, react, tailwindcss, vite, twilio, pipecat, cartesia, gemini, stepfun, claude, anthropic,
modernbert, huggingface, onnx, scikit-learn, vultr, creao, capital-one-nessie, sqlite, caddy, websockets

## "Try it out" links
- https://scammergetscammed.biz
- https://github.com/hay-ninja/scammergetscammed
- CREAO agent: https://agent.creao.ai/install/5c773c9c-10be-44d7-b636-3bfa5c6829c4?version=7241417b-b073-432d-bca7-eefbf2552e0e (agent ID `5c773c9c-10be-44d7-b636-3bfa5c6829c4`, latest run `e696c8f0-b4ef-4217-b589-1a920e789fa6`)
- Video link
