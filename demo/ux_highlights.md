# UX brief: what each screen must make the room look at

Paste this into the UI session. The features exist now (script card, model stage card, moment card, bank
overview, CREAO panel). This brief is about **emphasis**: at every beat of `DEMO.md`, the eye should land on one
thing within a second, from 4 m away, without me pointing. Polish only, no new data, no backend changes.
Done by **5:30 AM**. Check at 1920×1080 and 1366×768 on `http://127.0.0.1:8000`.

## Rules for every screen
1. **One hero per beat.** At any moment, exactly one element is the biggest and highest-contrast on screen. Everything
   else is quieter (smaller, greyer, thinner). If two things compete, shrink one.
2. **One colour job each.** Orange = numbers and the model's live read. Red = fraud, the block, danger. Green =
   money saved, held, approved. Navy = the bank's own UI. Don't use red for decoration or orange for warnings.
3. **Motion only means "this just changed".** Allowed: a new transcript line, a stage lighting up, an account card
   arriving, the moment card, a lozenge flipping, a number counting up. Nothing loops except the live dot.
   Respect `prefers-reduced-motion`.
4. **Words a judge understands.** Plain labels on screen ("Asking for a safe account", "Wire held"), raw codes
   (`safe_account_request`, `mule_account.blocked`) small and secondary or hidden.
5. **No scrolling, no clipped text** on `#/live` during the call or on `#/bank/overview` at the moment.

## Beat by beat

### Beat 1, waiting (`#/live`, before the call)
- **Hero:** the phone number **(832) 934-9457**, the largest text on the page, with "call Margaret" above it.
- The script card is visible and readable, so the judge can glance at what they'll say before dialling.
- Everything else (score, stages, intel, accounts) shows calm empty states in light grey, not "0" or "—" in
  heavy type.

### Beat 2, the call (`#/live`)
The judge reads the script, I narrate the model. Two heroes take turns, never at once:
- **The judge's next line.** In the script card, the next unread line is the boldest, with a small "next" marker.
  Lines already said fade to grey with a ✓. **The account numbers are the largest text in the card**, in mono,
  chunked ("5 7 2 – 1 0 9 – 0 8 6"), each chunk separated by a wide gap so it can be read in pieces.
- **What the model thinks.** After each caller line, the stage card ("Claiming to be an official" → "Creating
  fear" → "Demanding secrecy" → "Asking for a safe account") changes with a short crossfade, and the matching
  step in the scam-pattern stepper lights up with a single pulse. Confidence sits next to it, in orange.
- Transcript: the newest caller line gets a brief orange edge highlight and its small stage tag. Older lines
  dim slightly. Margaret's lines are visually calmer than the caller's.
- Scam likelihood: the bar animates smoothly. When it crosses the block line, the line itself flashes once and
  the label flips to "over the block line" in red.
- Intel card: each field fills with a short highlight as it's heard (name, agency, badge, callback).
- De-emphasise: "next move" coaching text, model names, the `…` menu.

### Beat 3, the account is read out (`#/live`)
- **Hero:** the account card that just arrived. Digits large and mono, routing checksum ✓ in green, the bank
  name, then the gate checks ticking in one by one (about 150 ms apart), ending in a red **BLOCKED** lozenge.
- The matching numbers in the script card get a ✓ so the judge sees "it heard exactly what I said".

### Beat 4, THE MOMENT (`#/live`)
- **Hero:** the moment card. It slides in at the top, full width, and stays. The headline is the biggest text
  on the page: "2 mule accounts blocked · **$8,500** wire held · **$41,000** in recall". The amounts count up
  from 0 over about 0.8 s.
- At the same moment, the rest of the page dims slightly (about 85% opacity) for 3 s so the card owns the room,
  then returns to normal.
- **"Open in CalHacks Federal →"** is the only black or primary button on the page, large, on the right.
- The red dot on the "CalHacks Federal" switcher pulses until clicked.

### Beat 5, the bank (`#/bank/overview`, arriving from the moment card)
The judges must feel they've walked into the bank's own office, not our app.
- On arrival from the moment card (`#/bank/overview?from=live` or a flag), **spotlight for 3 s**:
  1. The new case row or fraud account card: red left bar, "BLOCKED · mule account · FRD-1042", the bank and
     masked number.
  2. Dorothy's $8,500 row in "Payments under watch" flips PENDING REVIEW → **HELD** with the row flashing green
     once.
  3. "Money protected" counts up to **$49,500** in green.
  Run them in that order, about 0.6 s apart, so I can narrate them one by one.
- The seat card ("AI seat: Fraud Intelligence Analyst + Payments Controls Officer" with ✓/✗ permissions) is
  visible but quiet. It gets a hero moment only when I point at it in beat 7.
- Everything above the fold at 1366×768: protected $, blocked count, the flagged account, the payments
  table, "Awaiting your approval", and the investigator gadget.

### Beat 6, the CREAO investigator (`#/bank/overview` gadget or case detail)
- **Hero:** the **Run investigator** button, the only primary button in the gadget, with a one-line promise
  under it: "Search the whole ledger behind this account".
- While running: a stepper (Queued → Running → Done) with elapsed seconds, and a calm progress shimmer. Never a
  spinner alone.
- On done, findings reveal in this order, about 0.3 s apart:
  1. A one-sentence summary in large type ("This account is one node in a ring of 5. 7 more seniors sent $X;
     $Y is still pending and can be stopped").
  2. **Linked mule accounts**, each with its reason and an **Approve block** button (red/danger style).
  3. **Pending payments to stop** (amber, PENDING REVIEW).
  4. **Past payments to recall** (blue, Recall candidate).
- Approving a block: the row turns to "✓ Blocked", and the matching held/recall rows in the overview update with
  the same flip animation as Dorothy's. The "protected" number counts up again.
- The "cached" tag stays small and grey. It's honest, not a headline.

### Beat 7, the human decides (`#/bank/overview`)
- **Hero:** "Awaiting your approval": **Approve freeze** (navy primary) and **Reject** (secondary), the gate checks
  listed with green ✓, and the yellow "Sources disagree" line (memo says Federal Reserve, routing says a private
  bank).
- After Approve: "✓ Approved by J. Rivera" in green, and the newest audit row slides in at the top of Recent
  activity with the analyst's avatar.
- Now the seat card gets its moment: a single soft highlight on the ✗ rows ("✗ freeze accounts, needs an
  analyst", "✗ move money") as I say "the AI that talks can't block anyone".

### Beat 8, embed and stack (`#/api`, `#/how`)
- `#/how`: the pipeline left to right, phone → Twilio → Pipecat (Cartesia STT → Gemini → Cartesia voice) →
  ScamWatch (fine-tuned ModernBERT + rules + gate) → bank controls → CREAO investigator → analyst. **The gate box
  is the visual centre**, with "the voice AI has no tools" written next to it. Sponsor logos or names on each box.
- `#/api`: three endpoints and the webhook payload, large monospace, nothing else above the fold.

## Presenter controls (cheap, high value)
- Keyboard: `L` → `#/live`, `B` → `#/bank/overview`, `R` → reset (with a 1 s "reset" toast), `F` → fullscreen.
  Ignore keys while typing in an input.
- The `…` menu and the brain picker stay out of sight. Nothing on screen says "demo", "sim", "debug" or shows a
  model dropdown during the call.

## Check before you report
Run `scripts/sim_call.py scripts/judge_script.json` and record a screen capture of beats 1 to 7 at 1920×1080.
For each beat, name the hero element and confirm nothing else on screen is equally loud. Report pass/fail per beat.
