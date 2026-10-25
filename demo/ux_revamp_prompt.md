# Prompt: UX revamp, two apps (CalHacks Federal bank console + Margaret Live)

Paste everything below the line into the session that owns `web/`.

---

You own `web/` and the server. Rebuild the UI as **two clearly separate apps** that share the existing live
state (`/ws/dashboard` snapshot: `session`, `ledger`, `phone`, `model`, `flash`). Read `web/src/App.jsx` first:
it already has every data hook and component you need (transcript, stepper, intel, accounts, SAR modal,
approve, reset, model tab, audit, brain picker). Reuse the logic, replace the layout and styling.
Deadline: done and rehearsed by **4:00 AM**. Submission is 8:50 AM.

## Rules
- Do not change ScamWatch, the gate, `voice_bot.py` behaviour or the snapshot shape except where listed below.
- `scripts/replay_call.py` must still pass, and `scripts/sim_call.py` must still drive both apps.
- uvicorn serves `web/dist`, so finish with `npm --prefix web run build` and check `http://127.0.0.1:8000`
  (not `localhost`: the browser sends too many cookies there and the server returns 431).
- Projector-first: readable from 4 m, no scrolling during THE MOMENT, works at 1920×1080 and 1366×768.
- Keep the marketing pages in `web/src/Site.jsx` (landing, how it works, API docs, scripts); only restyle them
  lightly to match, and link both apps from the site nav.

## Routes (hash routes, as today)
- `#/live`: **Margaret Live** (shown during the call).
- `#/bank`: **CalHacks Federal Fraud Ops** console (switched to at THE MOMENT). Sub-routes `#/bank/overview`,
  `#/bank/members`, `#/bank/cases`, `#/bank/cases/:id`, `#/bank/blocklist`, `#/bank/payments`, `#/bank/audit`, `#/bank/model`.
- `#/console` keeps working (redirect to `#/live`) so nothing in the docs breaks.
- A small persistent switcher in both apps' top bars: "Margaret Live ⇄ CalHacks Federal" with a red dot on
  CalHacks Federal when there is an unseen block.

## App 1: CalHacks Federal Fraud Ops (`#/bank`): Jira layout, Bank of America colours
The judges must believe this is the bank's own internal tool and that our system is one "seat" inside it.

**Look**
- Jira structure: white top bar (logo, "Your work", "Cases", "Members", "Reports", search, avatar), a left sidebar
  with icons + labels, a page title with breadcrumb ("Fraud Ops / Payments Controls Dashboard"), and a grid of
  "gadget" cards each with a title and a `…` menu. Dense tables with status lozenges (small uppercase pills).
- Colours (Bank of America-like): navy `#012169` (top bar, primary buttons, headings), red `#E31837` (alerts,
  blocked, the moment), white and light grey `#F4F5F7` backgrounds, border `#DFE1E6`, text `#172B4D`,
  green `#00875A` for held/recovered, amber `#FF991F` for pending review. Font: system UI / Inter.
- Lozenges: `BLOCKED` red, `HELD` green, `PENDING REVIEW` amber, `RECALL REQUESTED` blue, `ACTIVE` grey, `FROZEN` navy.

**Overview gadgets** (the screen shown at THE MOMENT, everything above the fold)
1. Money protected (big number, green): held + recall requested, with a small "+$49,500 this call" delta.
2. Mule accounts blocked (big number, red) with provisional vs confirmed split.
3. Cases by status donut: New / Awaiting approval / Confirmed / Rejected.
4. Payments under watch table: member, amount, destination, status lozenge. Dorothy's $8,500 row flips
   PENDING → HELD with a 1 s red-to-green highlight when the block lands.
5. "Awaiting your approval" card: the freeze request with **Approve** and **Reject** buttons and the gate's
   reasons (see Hyphenate items below).
6. Recent activity feed from the audit log: actor icon (ScamWatch seat / rules / analyst / system), action, time.

**Members** (the client table the user asked for)
- One Jira-style table of every CalHacks Federal member from the seed (~45): member ID, name, age, member since,
  accounts (masked ••1234), balance, last activity, risk flags, watch status lozenge. Sortable columns, a filter
  bar (All / Seniors 75+ / On watch / Affected by a case), search. Clicking a row opens a member side panel
  with their accounts and transfers. Victims (Dorothy, Harold, June) show their case link.
- Add `GET /api/bank/members` (and `/api/bank/members/{id}`) returning that data from SQLite; add balances,
  member_since and a masked account to the seed if they don't exist. Deterministic, seeded, no real data.

**Cases**: table of cases (one per decoy call): key `FRD-1042`, summary ("Phantom hacker · Federal Reserve
impostor"), priority, status lozenge, assignee ("ScamWatch seat" until an analyst picks it up), created, time
in status. Case detail page: the accounts and gate checks, holds and recalls, the transcript excerpt, the SAR
draft (Claude), and the decision history.

**Blocklist**, **Payments**, **Audit log**, **Model** (move the existing model tab here: confusion matrix,
held-out results, 0 false blocks, latency).

**Seat card** (top right of Overview, always visible): "AI seat: Fraud Intelligence Analyst + Payments Controls
Officer". Under it, its permissions as a checklist: ✓ place reversible holds, ✓ request recalls, ✓ draft SARs,
✗ freeze accounts (needs an analyst), ✗ move money, ✗ see full member data. This is the Hyphenate pitch on screen.

## App 2: Margaret Live (`#/live`): airy lavender cards
Style reference: soft lavender gradient background (`#F3EFFC` → `#E9E3FA` with a faint purple blob), white
cards at ~85% opacity with 12 px radius and no heavy borders, small uppercase pill labels in indigo
(`#5B5BD6` on `#ECEBFF`) above each card, large calm dark text. One idea per card, lots of whitespace.

Layout, top to bottom, no scrolling at 1080p:
1. Header: "Margaret, 78 · AI decoy" + call status pill (Waiting / Live / Ended) + big timer + the phone number
   `(832) 934-9457` in large type while waiting.
2. Row of 3 small cards: SCAM LIKELIHOOD (bar vs the block threshold), STAGE (the current stage in words,
   e.g. "Asking for a safe account"), TIME WASTED (scammer's time).
3. Main left (wide): LIVE TRANSCRIPT. Chat bubbles, caller left grey, Margaret right indigo, digits
   highlighted, the partial line in light grey, auto-scroll pinned to the bottom.
4. Main right column: SCAM PATTERN (vertical stepper: Authority → Fear → Secrecy → Safe account → Account given),
   CALLER INTEL (name, agency, badge, callback), ACCOUNTS HEARD (each with checksum ✓/✗, bank, gate result).
5. THE MOMENT: when an account is blocked, a full-width red-bordered card slides in at the top: "Mule account
   blocked · $8,500 wire held · $41,000 in recall" with a button **"Open in CalHacks Federal →"** that goes to
   `#/bank/overview`. This is the handoff between the two apps in the demo.
- Keep Reset demo and the brain picker, but tuck them into a small `…` menu so they don't clutter the screen.

## Hyphenate strengtheners (P1, after both apps work end to end)
Their brief lists hard parts we barely cover. Each of these is small:
1. **Controller can say no.** Add **Reject freeze** with a required reason. On reject: blocklist row stays
   `provisional`, the case goes to `Rejected`, holds stay until the analyst releases them, all audited. Endpoint
   `POST /api/reject {reason}`.
2. **Sources that disagree.** On each blocked account, show the discrepancy the seat used: the wire memo says
   "Federal Reserve Protected Acct" but the routing number resolves to a private bank (from the routing table);
   the Federal Reserve never holds consumer accounts. Show it as a "Sources disagree" box in the case detail.
3. **Time.** A button in the bank app, "Simulate: new wire next week", that has a different member try to wire
   to an already-blocked mule; it gets held automatically with an audit line "matched blocklist entry from case
   FRD-1042 (created <date>)".
4. **Defend a decision.** In the case detail, a "Why?" panel listing each gate check with pass/fail and the data
   behind it. For the title-company trick script, the panel explains why nothing was blocked.

## Done means
- `#/live` and `#/bank` both render from the same live state; `sim_call.py scripts/judge_script.json` produces
  the full moment on `#/live`, and clicking "Open in CalHacks Federal" shows Dorothy HELD, $49,500 protected, the
  freeze awaiting approval; Approve and Reject both work and both are audited.
- `#/bank/members` shows every seeded member in a sortable, filterable table.
- `replay_call.py` passes; `npm --prefix web run build` is clean; screenshots of both apps at 1920×1080.
