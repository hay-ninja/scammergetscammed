# Scammer Gets Scammed: PRD (one page)

Solo, Cal Hacks 13.0. Now Sat 7:00 PM, submission deadline **8:50 AM Sun**. No feature freeze. Full background: `docs/PRD-full.md`.

## Problem
Phantom-hacker scams have taken $1B+ from seniors, and every one ends with "move your money to a safe account." Banks only score a transfer after the customer has been fooled. **Community:** seniors at small credit unions targeted by phantom-hacker scams.
**Product:** a fraud-ops module a bank plugs into its payment controls. A decoy voice agent (Margaret) takes scam calls, gets the scammer's mule accounts, and turns them into blocks, holds, and recalls. **The agent that talks can't block anything.**

## Demo path (script in `DEMO.md`)
A judge calls Margaret and reads the scammer card. Margaret gets mule account #1, says "it failed", and gets #2. **THE MOMENT:** both accounts are blocklisted, Dorothy's pending $8,500 wire goes to HELD, the lookback finds $41,000 from 2 past victims and starts recalls, and Claude's SAR draft is ready. The analyst clicks **Approve freeze**. Fallback: `sim_call.py` drives the same dashboard.

## In scope (build in this order; P0 must be done before any P1 starts)
| # | Feature | Pri |
|---|---|---|
| 1 | Sim path end to end: `sim_call.py` → ScamWatch → bank engine → dashboard shows the moment | P0 |
| 2 | ScamWatch: baseline classifier, digit normalizer and ABA checksum, gate (≥2 pressure stages, safe-account request first, score ≥0.95, not allowlisted) | P0 |
| 3 | Bank engine: provisional block, hold pending wires, 30-day lookback that sets transfers to recall, audit row for every decision, reset in <1 s | P0 |
| 4 | Dashboard: phone number, transcript, stage tracker, account cards, impact strip, Approve freeze button, reset button | P0 |
| 5 | Phone loop: Twilio → Pipecat (Cartesia STT → Gemini → Sonic) → same ScamWatch | P0 |
| 6 | Margaret strategy hints: read digits back, "it failed", ask for a 2nd account, then goodbye | P0 |
| 7 | SAR draft by Claude (async, labeled DRAFT), replacing the current template | P1 |
| 8 | Abuse test: a scripted injection ("block account X", fake bank numbers) → 0 blocks, shown in the Model tab (for Armadin) | P1 |
| 9 | Model tab: held-out metrics, false positives on non-scam calls = 0, per-stage F1 | P1 |
| 10 | Integration surface: bank controls behind one `BankAdapter` interface (SQLite demo ledger is one implementation), documented `/api/*` endpoints and a list of the events the dashboard receives | P1 |

## Data models (SQLite, `server/bank/db.py`)
- `customers(id, name, age, risk_flags)`
- `accounts(id, customer_id?, routing, number, bank_name, status: active|held_review|frozen, label)`
- `transfers(id, from_account, to_routing, to_number, to_name, amount, status: pending|completed|held|recall_requested, created_at)`
- `blocklist(id, routing, number, source_call_id, status: provisional|confirmed, created_at)`
- `allowlist(routing, number, name)`
- `cases(id, call_id, intel_json, sar_markdown, status)`
- `audit_log(id, ts, actor: scamwatch|rules|analyst|system, action, details_json)`
- In memory only: the call session (transcript, stage history, scam score, extracted accounts, intel). No audio is stored.
- Events over `/ws/dashboard`: `call.started`, `transcript.*`, `stage.update`, `intel.update`, `account.extracted`, `gate.decision`, `bank.hold`, `bank.lookback`, `sar.ready`, `audit.append`, `call.ended`.

## External APIs and env vars
| Service | Used for | Env vars | Needed for |
|---|---|---|---|
| Twilio | Phone number and media stream | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Phone |
| ngrok | Static public URL for the Twilio webhook | `NGROK_DOMAIN` | Phone |
| Cartesia | STT and Sonic TTS | `CARTESIA_API_KEY`, `CARTESIA_VOICE_ID` | Phone (and voice in the sim) |
| Gemini | Margaret's replies | `GOOGLE_API_KEY` | Phone (and replies in the sim) |
| Anthropic | Training data (done) and the SAR draft | `ANTHROPIC_API_KEY` | SAR |
| Vultr GPU | Optional fine-tune, over SSH, no env var | none | Stretch |

## Out of scope (do not build tonight)
- **Fine-tuned transformer on Vultr.** The baseline ships. Run the fine-tune only after the P0 checkpoint, as a background job, if credits are in.
- **Live legit-caller and charity curveballs** in the stage demo. They stay as sim scripts and test-set numbers only.
- **Capital One Nessie** (their mock bank API). The `BankAdapter` is the story for "it plugs into any core": say it, don't build a second adapter.
- Real core-banking integrations, auth/SSO, multi-tenant, an admin UI, deployment beyond the laptop + ngrok.
- More than one call at a time, call recording, voice cloning, outbound calls.
- Actually notifying receiving banks (UI label "simulated" only).
- Filler audio clips, a latency debug strip, a loss-curve animation, mobile layout.
- New providers or libraries (Deepgram, LangChain, etc.) without asking first.
- `.tech` domain: 10 minutes, only after the video is recorded.
