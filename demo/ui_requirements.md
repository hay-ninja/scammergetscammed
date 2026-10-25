# UI requirements for the demo (paste into the UI session)

You own `web/`. These are the requirements the live demo in `DEMO.md` depends on. Go through every item,
check it in the browser at `http://127.0.0.1:8000` (not `localhost`), fix what's missing, and reply with a
pass/fail list. **P0 items first. Feature code stops at 5:30 AM; all code stops at 7:00 AM.**
Don't change MargaretSGS, the gate, `voice_bot.py` or `persona.py`. `scripts/replay_call.py` must still pass and
`npm --prefix web run build` must be clean.

Known gaps right now: **L3 (script panel) and B6 (CREAO investigator panel) don't exist yet.**

## Global
- **G1 (P0)** Projector: readable from 4 m at 1920×1080 and 1366×768. **No scrolling needed** on `#/live`
  during the call or on `#/bank/overview` at the moment.
- **G2 (P0)** Both apps update live from `/ws/dashboard` without a refresh. Switching tabs is instant and
  loses nothing.
- **G3 (P0)** The app switcher "Margaret Live ⇄ CalHacks Federal" is in both top bars, with a red dot on
  CalHacks Federal when there's a block you haven't seen.
- **G4 (P1)** Names everywhere say "CalHacks Federal Credit Union". Nothing says "Bay Federal".
- **G5 (P1)** Nothing breaks on an empty state (after a reset, before any call) or if the socket drops
  (show "reconnecting", then recover).

## Margaret Live (`#/live`): what the room watches during the call
- **L1 (P0)** Waiting state: the phone number **(832) 934-9457** is huge and centered, with "waiting for a
  call". Readable from across the room.
- **L2 (P0)** Call status (waiting / live / ended) and a big call timer in the header.
- **L3 (P0, missing)** **"Your script" card** for the judge to read off the projector. It defaults to the
  Federal Reserve script from `web/src/scripts.js`, with a small picker for the others. At most about 6 short
  lines so the call stays under 90 s. The account numbers are big and spaced into chunks
  ("5 7 2 – 1 0 9 – 0 8 6"). A line turns grey once the caller has said something close to it. Visible for
  the whole call, with no scrolling.
- **L4 (P0)** Live transcript: caller and Margaret visually distinct, digits highlighted, the in-progress
  partial line shown, auto-scrolled to the newest line.
- **L5 (P0)** **What the model thinks, live.** The current scam stage in plain words ("Asking for a safe
  account") and its confidence. A small stage tag on each caller line. The scam-pattern stepper (Authority →
  Fear → Secrecy → Safe account → Account given) lights up as stages are detected.
- **L6 (P0)** Scam likelihood bar with the block line marked. Read the threshold from config: it's **0.90
  now**, not 0.95, so check every hardcoded 0.95.
- **L7 (P0)** Accounts heard: each account appears as soon as it's heard, with routing ✓/✗ checksum, the bank
  name, and blocked / observed, plus which gate checks passed.
- **L8 (P1)** Caller intel card: name, agency, badge, callback number.
- **L9 (P0)** **The moment**: when an account is blocked, a card slides in at the top ("Mule account blocked ·
  $8,500 wire held · $41,000 in recall") with a big **"Open in CalHacks Federal →"** button that goes to
  `#/bank/overview`.
- **L10 (P1)** End of call: a summary (length, mule accounts, $ protected, real customer data shared: 0).
- **L11 (P0)** Reset demo is reachable in one click from the `…` menu and puts the page back to L1 in under 1 s.

## CalHacks Federal Fraud Ops (`#/bank`): the bank's own tool
- **B1 (P0)** Jira-style layout in Bank of America colors (navy `#012169`, red `#E31837`, white). Top bar,
  left sidebar, a page title with breadcrumb, and gadget cards. It must look like the bank's internal tool,
  not ours.
- **B2 (P0)** **Overview at the moment, above the fold:**
  - money protected
  - mule accounts blocked
  - the newly flagged account marked as fraudulent: bank, masked number, "BLOCKED" lozenge, case key
  - payments under watch, with Dorothy's $8,500 flipping PENDING → **HELD** with a highlight
  - past payments sent to recall
  - "Awaiting your approval" with **Approve freeze** and **Reject** (Reject needs a reason)
- **B3 (P0)** **Seat card** always visible on the overview: "AI seat: Fraud Intelligence Analyst + Payments
  Controls Officer", with its permissions: ✓ holds, ✓ recalls, ✓ draft SAR; ✗ freeze, ✗ move money,
  ✗ full member data.
- **B4 (P0)** Members table of every member, Jira-style: sortable, a filter bar (All / Seniors 75+ /
  On watch / Affected by a case), and search. A row opens a side panel with the member's accounts and
  transfers.
- **B5 (P0)** Case detail for the live call:
  - the gate checks with pass/fail and the data behind each ("Why?")
  - the "Sources disagree" box (the memo says Federal Reserve, the routing number says a private bank)
  - holds and recalls, a transcript excerpt, the SAR draft, and the decision history
- **B6 (P0, missing)** **MargaretSGS Investigator (CREAO) panel** in the case detail, and as a gadget on the
  overview:
  - **"Run investigator"** button, calling `POST /api/creao/run`
  - status: queued → running → done, read from `investigation` in the live state or
    `GET /api/creao/investigation`
  - findings: other mule accounts in the ring, victims and amounts, pending payments to hold, and past
    payments to review
  - each proposed block has an **Approve block** button calling `POST /api/creao/approve_block`
  - holds and recalls for approved blocks show up in B2 at once
  - **Fallback, required:** if CREAO isn't configured (`503`) or hasn't returned in 20 s, show canned
    findings built from the seeded hidden ring (the D. Okoro account `52871904`, mules `92650318` and
    `66019284`, Clara Bennett's and Nora Diaz's pending wires, and the earlier victims). They show on the same
    screen with a small "cached" tag. The demo must never show an error or an empty panel here.
- **B7 (P1)** "Simulate: new wire next week" holds a later wire to an already-blocked mule and cites the
  original case.
- **B8 (P1)** Blocklist, Payments, Audit log, and Model pages all work. The audit log shows every action with
  its actor (MargaretSGS seat / rules / analyst / CREAO / system).

## Site (`#/`, `#/how`, `#/api`)
- **S1 (P0)** `#/how` (architecture) is presentable on the projector for the tech-stack segment: phone →
  Twilio → Pipecat (Cartesia STT → Gemini → Cartesia TTS) → MargaretSGS (fine-tuned ModernBERT + rules + gate)
  → bank controls → CREAO investigator → analyst.
- **S2 (P1)** `#/api` shows the embed story: the `/api/v1` endpoints and the `mule_account.blocked` webhook.

## Acceptance run (do it, then report)
1. Reset → `#/live` shows L1.
2. Run `.venv/Scripts/python scripts/sim_call.py scripts/judge_script.json`.
3. On `#/live`, check L3–L9 in order. Then click "Open in CalHacks Federal".
4. On the bank side: B2 shows Dorothy HELD and $49,500 protected → Run investigator → findings (live or
   cached) → Approve one block → Approve freeze. Each step shows up in the audit log.
5. Reset again and confirm everything is back to the starting state.
6. Screenshots of `#/live` mid-call, `#/live` at the moment, `#/bank/overview` after approval, and the
   investigator panel, all at 1920×1080.
