# Demo plan (locked 2:30 AM Sun; deadline 8:50 AM)

## Clock
| Time | What | Rule |
|---|---|---|
| now → 3:00 | Phone smoke test, then the script panel on `#/live` | |
| 3:00 → 5:30 | CREAO investigator live, or hardcoded at 4:30 | **Feature code stops 5:30** |
| 5:30 → 7:00 | Bug fixes only, 3 phone rehearsals + 1 sim rehearsal | **Hard stop for all code: 7:00** |
| 7:00 → 8:05 | README, Devpost text, judge card, screenshots, final commit | No code |
| 8:05 → 8:50 | Record the video (opens with THE MOMENT), upload, submit | Submit by 8:40 |

## Before each judge (30 s)
1. Open `http://127.0.0.1:8000/#/live` on the projector (not `localhost`), fullscreen with F11.
2. Open `…` → **Reset demo**. Check that it says "waiting for a call" and the phone number shows.
3. Open a second tab at `#/bank/overview` and leave it there.

## Run of show (target 3:30, call ≤ 90 s)
| t | You | Judge | Screen |
|---|---|---|---|
| 0:00 | "Americans 60+ lost $4.9B to fraud last year. Phantom hacker scams always end with *move your money to a safe account*." | | `#/live`, number showing |
| 0:20 | "Phantom hacker: a fake tech support, then a fake bank, then a fake federal agent who gives you a 'safe account'. You're that agent. Call this number and read the script on screen." | Dials (832) 934-9457 on speaker | Script panel shows the Federal Reserve script |
| 0:30 | Point at the stage the model is calling for each line and the scam likelihood bar | Reads lines 1–4 | Stages light up, intel card fills |
| 1:20 | "Now the account." | Reads routing + account in short chunks | Account card: checksum ✓, gate checks |
| 1:40 | "**This is the moment.**" | Margaret says it failed; judge gives the backup, she says goodbye | Red moment card on `#/live` |
| 2:00 | Click **Open in CalHacks Federal →** | | Bank overview: mule flagged, Dorothy's $8,500 HELD, lookback recalls |
| 2:20 | "Now the bank acts. The CREAO investigator searches the whole ledger behind this account." Run it | | Findings: hidden ring accounts, victims, proposed blocks |
| 2:50 | Approve one proposed block, then **Approve freeze**. "The AI that talks can't block anyone. A trained model, fixed rules and a human all have to agree." | | Audit log lines from analyst |
| 3:10 | "Any bank can plug this in: one API, one webhook." Then `#/how` for the stack | | Architecture page |

**Judge goes off-script:** fine. Margaret plays along and numbers still get captured and checked.
**Phone fails:** Reset, then `.venv/Scripts/python scripts/sim_call.py scripts/judge_script.json`. Same screens.
**CREAO slow or down:** the hardcoded findings (from the seeded hidden ring) show instead. Same screen.

## Cut list (in this order) and what to say if asked
1. **Option C, our own Margaret LLM.** "We fine-tuned the model that makes the decisions, not the voice. That's deliberate: the voice has no power."
2. **Phases 1–2 of the phantom scam, and chaining handoff numbers.** "We demo phase 3 because that's where the money moves. Phases 1 and 2 are in our training data and the scripts page."
3. **Extra live scripts.** Live: the Federal Reserve script, plus the title-company trick test only if a judge asks for a trap. "The other five are sim-tested; they're on the scripts page."
4. **Claude SAR rewrite.** "Claude wrote our 2,500-call training set and runs the red-team benchmark. The SAR draft comes from the case data and goes to an analyst."
5. **Nessie ledger.** "The ledger sits behind one adapter. SQLite for the demo, and a Nessie seed script shows a second backend."
6. **v3 classifier from Vultr.** Ship the current model (0 false blocks on held-out legitimate calls). "We only swap models when the new one beats the old on held-out calls with zero false blocks."
7. **Site polish.** Nothing to say.

## Submission checklist (7:00 → 8:40)
- [ ] Video, about 2 min, opens with THE MOMENT, then rewinds to the call
- [ ] Devpost: seats line "Fraud Intelligence Analyst + Payments Controls Officer for CalHacks Federal Credit Union"; real vs simulated; proof numbers; opt into Cartesia, Hyphenate, Best Solo, Microsoft, Armadin, MLH Gemini, MLH Vultr, Anthropic, CREAO
- [ ] Named community (Anthropic): seniors at small credit unions targeted by phantom-hacker scams
- [ ] README: run steps, Cartesia features used, real vs simulated, limitations
- [ ] Final commit and push
