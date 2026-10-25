# Prompt: train and host our own Margaret LLM on Vultr (side experiment)

Paste everything below the line into a fresh Claude Code / Devin session opened in this repo.

---

You are helping with a hackathon project in this repo ("ScammersGetScammed"). Margaret is an AI decoy
grandma that answers scam calls for a bank. Today her replies come from Gemini (`gemini-3.5-flash-lite`)
with StepFun (`step-3.7-flash`) as failover, wired in `server/voice_bot.py` via Pipecat (`make_llm()`,
`LLMSwitcher`). Her persona prompt is `server/persona.py` (`SYSTEM_PROMPT`, `FIRST_LINE`, `coach()`):
every caller line arrives with a bracketed coaching note appended, which she must follow and never read aloud.

**Goal:** a side experiment. Fine-tune a small open model to be Margaret, host it on a Vultr GPU behind an
OpenAI-compatible endpoint, and measure whether it is faster and as good as Gemini. Do NOT change the
production path; the main session is still working on the repo. Only add new files plus the small
integration described at the end.

**Hard limits**
- Budget: at most $40 of Vultr credit and $10 of Anthropic credit. Destroy the GPU instance when done unless told otherwise.
- Deadline: have a measured result by 5:00 AM. If it isn't working by 3:30 AM, stop and write up what you found.
- Never use real personal data. Routing numbers start with 5 (fictional). Margaret never gives real data.
- Don't edit `server/persona.py`, `server/scamwatch/*`, or `training/*` (owned by the main session).

**Steps**
1. **Data (≈2,000 conversations, `experiments/margaret_llm/data.jsonl`).** Build chat-format examples:
   system = `SYSTEM_PROMPT`, user turns = caller line + `coach(strategy)`, assistant turns = Margaret.
   - Caller lines: take them from `training/data/calls.jsonl` and `training/data/heldout.jsonl`
     (`turns` with `speaker == "caller"`; types like `scam_vs_stalling_senior`, `phantom_hacker_gov`, plus
     legitimate types so she learns to let real callers go). Strategy notes: replay each call's caller
     lines through `server.scamwatch.session.CallSession` to get the live `state["strategy"]` per turn
     (point `server.config.DB_PATH` at a temp copy of `bank.db` first, as `scripts/bench_margaret.py` does).
   - Margaret's lines: generate with Claude (`claude-opus-5-5`, low effort) acting as Margaret given the
     persona, coaching note and history. Claude plays the decoy, not the scammer, so it won't refuse.
   - Also include the Margaret lines from `training/data/bench_transcripts.jsonl` that the judge rated well.
2. **GPU.** Create a separate Vultr instance (don't use 144.202.109.109, it trains the scam classifier).
   One L40S or A100 is enough. Ubuntu 24.04, SSH key `~/.ssh/flow_vultr` (on Windows: `$HOME\.ssh\flow_vultr`).
   Vultr's new console has no SSH-keys page in an obvious place; a boot Startup Script that appends the
   public key to `/root/.ssh/authorized_keys` works.
3. **Fine-tune.** LoRA on a small instruct model with strong chat skills (try `Qwen/Qwen3-4B-Instruct-2507`
   first, fall back to `meta-llama/Llama-3.2-3B-Instruct`). Unsloth or TRL SFT, 1–2 epochs, merge the
   adapter. Keep replies short (Margaret says 1–2 sentences).
4. **Serve.** vLLM OpenAI-compatible server on port 8000, model name `margaret`, API key required
   (`--api-key`), bf16, `--max-model-len 4096`. Open only port 8000 and 22 in the firewall.
5. **Measure** against Gemini on the same 40 benchmark calls: add `--provider openai --base-url ... --api-key ...`
   support to `scripts/bench_margaret.py` (it uses the Google GenAI client today; add an OpenAI-compatible
   branch in `Margaret.reply`). Use `--caller replay` (no caller refusals). Report first-token latency
   p50/p95, leaks, character breaks, naturalness, and false blocks, next to Gemini's numbers. Write
   the results to `experiments/margaret_llm/RESULTS.md`.
6. **Integrate (only if it's at least as good).** In `server/voice_bot.py` `make_llm()`, add a third option
   read from env `OWN_LLM_URL`, `OWN_LLM_KEY`, `OWN_LLM_MODEL` (an `OpenAILLMService` like the StepFun one),
   selectable with env `MARGARET_BRAIN=gemini|stepfun|own`, defaulting to the current behavior.
   Tell the user the three env values to paste into `.env`. Never write keys into tracked files.

**Deliverables:** `experiments/margaret_llm/` (data builder, train script, serve command, RESULTS.md),
the benchmark flag, the optional `make_llm()` option, and a short summary: latency vs Gemini, quality vs
Gemini, cost, and whether to use it in the live demo.
