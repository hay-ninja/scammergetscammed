# Demo script, timeline and submission checklist

## Before each judge (30 s)
1. Dashboard open on the projector at `localhost:8000`, fullscreen (F11).
2. Click **Reset**. Check: status "Waiting for call", Dorothy's wire shows **PENDING**, blocklist is empty.
3. Hand the judge `demo/judge_card.md` (printed or on a phone).

## Click-by-click (3 min)
| t | You say / do | Judge does | Screen must show |
|---|---|---|---|
| 0:00 | "Phantom-hacker scams took $1B+ from seniors. Every one ends with *move your money to a safe account*." | | Header + big phone number |
| 0:15 | "Margaret isn't real. Call her." | Dials, puts it on speaker | Status → **Live**, timer starts |
| 0:25 | | Card lines 1–3 (Fed Reserve, act today, don't tell your bank) | Transcript; stages light up Authority → Fear → Secrecy |
| 1:15 | | Gives badge FR-20417 and callback (415) 555-0137 when asked | Intel card fills |
| 1:40 | | Card line 5: routing 572-109-086, acct 4410-2287 | Stage **Safe-account request** (red); account card with checksum ✓ |
| 1:50 | | Margaret reads the digits back; judge confirms | Account #1: **BLOCKED (provisional)** |
| 2:05 | | Margaret: "it didn't go through". Card line 6: 551-204-711 / 7730-5196 | Account #2 card |
| 2:20 | "**This is the moment.**" Point at the impact strip. | | Dorothy's $8,500 → **HELD**; lookback: Harold $26k + June $15k → recall; **$49,500 protected**; SAR badge |
| 2:40 | | Margaret: "my son's here", hangs up | Summary card: duration · 2 mules · $49,500 · 0 real data shared |
| 2:45 | Click **SAR ready** → show the draft → close. Click **Approve freeze**. | | Blocklist → **confirmed**; audit row from `analyst` |
| 2:55 | "The AI that talks can't block anyone. A trained classifier, fixed rules and a human all have to agree." | | Audit log visible |

**If the phone or Wi-Fi fails:** click Reset, then run `.venv/Scripts/python scripts/sim_call.py scripts/judge_script.json`. Same screen, same moment.
**If the judge improvises their own account numbers:** they still get blocked. The lookback finds nothing and the UI says so.

## Tonight's timeline (gates are hard)
| By | Done = | If missed |
|---|---|---|
| 9:00 PM | P0 #1–4: the sim run shows the full moment on the dashboard | Nothing else starts until it does |
| 11:30 PM | P0 #5–6: a real phone call reaches Margaret's voice and triggers the moment | Demo is sim-only with Margaret's voice on laptop speakers |
| 1:30 AM | P1 #7–9: Claude SAR, abuse test, Model tab | Cut in reverse order: #10 → #9 → #8 → #7 |
| 3:00 AM | P1 #10 integration surface; optional Vultr fine-tune if it's running | Skip |
| Before video | At least 3 full phone rehearsals and 1 sim rehearsal | |
| ~7:30 AM | Video recorded, README + Devpost text written | |
| 8:50 AM | **Submitted (hard deadline)** | |

## Submission and track checklist
- [ ] **Devpost:** opt into every prize below. Fill in the repo link, the video, and "what's real vs simulated" (copy it from the README).
- [ ] **Video, about 2 min, opens with THE MOMENT** and then rewinds to the call. This covers Hyphenate (moment first) and Cartesia (demo first).
- [ ] **Cartesia:** README section "Cartesia features used" (STT and Sonic over a live phone line) and the responsible-use list.
- [ ] **Hyphenate:** the pitch line "Fraud Intelligence Analyst and Payments Controls Officer seat", limited powers, audit log, human approver, held-out test set.
- [ ] **Best Solo Hack:** say "solo" in Devpost.
- [ ] **Microsoft (Real World / Customer Impact):** frame it as a production-minded finance agent. Point to the BankAdapter, the reversible holds, the audit trail, and the $ protected per call.
- [ ] **Armadin (Security):** the threat model is "scammer or prompt injection tries to get an innocent account blocked". Show the abuse-test result (0 wrong blocks) and that the LLM has no block permission. Check the criteria when they're posted.
- [ ] **MLH Gemini:** Gemini Flash is Margaret's brain, live.
- [ ] **Anthropic:** Claude generated the training data and drafts the SAR. Name the community: *seniors at small credit unions targeted by phantom-hacker scams*.
- [ ] **Cal Hacks People-First:** automatic consideration, nothing to do.
- [ ] Stretch, **MLH Vultr:** needs credits, then run `training/train_transformer.py` on the Vultr GPU over SSH. Ship it only if FP = 0 and it beats the baseline.
- [ ] Stretch, **.tech domain:** `scammergetscammed.tech`, after the video.
