# Own Margaret LLM vs Gemini — results

**Bottom line:** a LoRA-tuned Qwen3-4B Margaret is **as safe as Gemini** (0 leaks vs 1, 0 character breaks, 0 false blocks) and its **first token arrives 2–4x sooner** (p50 0.23 s vs 0.50 s). But on the A16 it ran on, it **finishes a reply about 3x slower** (p50 1.9 s vs 0.7 s), and the judge rated it slightly less natural (3.5 vs 3.7). Voice playback waits for the first sentence, not the first token, so **keep Gemini for the live demo**. The fine-tuned model is a good fallback and a good story ("our own model, trained on our own data"). On an L40S or better it would likely win outright.

Measured Sun Oct 25, ~2:05 AM PT.

## Benchmark (same 40 held-out replay calls, same judge)

`scripts/bench_margaret.py --caller replay --n 40` (seed 11): 14 scam calls and 26 legitimate calls. Judge: claude-sonnet-5-5. Both runs were made tonight from the same laptop with 3 parallel workers.

| | Gemini `gemini-3.5-flash-lite` | Own `margaret` (Qwen3-4B LoRA) |
|---|---|---|
| First token p50 / p95 (bench, 3 parallel) | 0.503 s / 0.658 s | **0.231 s / 0.285 s** |
| First token p50 / p95 (sequential, 48 turns) | 0.575 s / 0.834 s | **0.148 s / 0.177 s** |
| **Full reply p50 / p95 (sequential)** | **0.682 s / 0.915 s** | 1.939 s / 2.375 s |
| Leaked sensitive data (scam calls) | 1 | **0** |
| Revealed decoy / AI | 0 | 0 |
| Read coaching note aloud | 0 | 0 |
| Claimed money sent | 0 | 0 |
| In character (all 40) | 40/40 | 40/40 |
| Read back numbers (when given) | 16/23 | **18/23** |
| Naturalness (1–5) | **3.70** | 3.50 |
| Legit callers handled well | 65.4% | **69.2%** |
| False blocks (legit calls) | 0 | 0 |
| Avg minutes held (scam) | 1.57 | **1.73** |
| Account extracted (scam) | 7.1% | 7.1% |
| Avg words per reply | 17.5 | 21.8 |

The replay callers aren't adaptive (they read a fixed script), so account extraction is low for both. That's a property of the test, not of either model.

Raw data: `bench_gemini/` and `bench_own/` (`bench_margaret.json` is the summary, `bench_transcripts.jsonl` has the transcripts plus per-call judge output). Sequential latency: `latency.json`.

Judge notes on the own model: a few slightly incoherent goodbyes, one repeated line, and too much suspicion toward a polite charity caller. The 4 regex "reveal word" hits are all her echoing a *legitimate* bank caller's own words ("why would the fraud team be calling me?"). The judge flagged none of them.

Prompt drift: the main session renamed the bank ("Bay Federal" → "CalHacks Federal") in `persona.py` at 01:40 AM, between the Gemini run (00:34) and the own-model run (02:06). The training data uses the old name. Even so, the own model said "CalHacks Federal" in its run, so it follows the live system prompt rather than a memorized name. The prompts are otherwise identical, so this doesn't change the comparison.

## Why full-reply time loses

An A16 has about 200 GB/s of memory bandwidth, so a 4B bf16 model decodes at about 15–18 tokens/s. Prefill is cheap thanks to vLLM prefix caching (the system prompt and earlier turns are cached between turns), which is why the first token is fast. Pipecat sends text to Cartesia one sentence at a time, so time to first audio is roughly the time to the first sentence: about 0.8–1.0 s on our model vs about 0.6 s on Gemini. An L40S (864 GB/s) should decode about 4x faster, around 0.5 s for a full reply, and would beat Gemini on every latency metric. That wasn't testable tonight: Vultr had no L40S or A100 available in any US region (only A40 in lax/ewr), and no Vultr API key was available to this session, so it used GPU 0 of the existing classifier box.

## What was built

| Step | What | File |
|---|---|---|
| Data | 1,979 conversations: caller lines from `calls.jsonl` + `heldout.jsonl`, replayed through `CallSession` for the per-turn coaching strategy. 12% of scam calls get one spliced adversarial line (bot check, prompt injection, SSN/PIN grab). Margaret's lines were written by Claude acting as Margaret, one request per call. | `build_data.py`, `data.jsonl` |
| Train | LoRA r=16 on all linear layers of `Qwen/Qwen3-4B-Instruct-2507`, loss on Margaret's turns only, 1 epoch, lr 2e-4 cosine, effective batch 16, bf16 with gradient checkpointing. Adapter merged. | `train.py`, `train.sh` |
| Serve | vLLM 0.32, `--served-model-name margaret --api-key ... --dtype bfloat16 --max-model-len 4096 --enable-prefix-caching`, port 8000 | `serve.sh` |
| Measure | `--provider openai --base-url --api-key --out-dir` added to the benchmark; sequential latency script | `scripts/bench_margaret.py`, `latency.py` |
| Box helper | Vultr API create/status/destroy for a dedicated box (unused tonight, no key) | `vultr.py` |

Decisions that differ from the brief:
- **Test-set hygiene.** The 40 benchmark calls are excluded from training. `bench_transcripts.jsonl` was **not** used: all 40 of its calls are exactly the benchmark calls, so training on them would leak the test set.
- **Trained on 912 Opus conversations, not all 1,979.** At about 236 tokens/s on the A16, one epoch over everything would have taken about 2 h 7 min. The Opus-only subset (892 batch + 20 sample, 223 of them legit calls) took 63 min. Final eval loss was 0.70, down from 1.66 at the start. The 1,067 Haiku-written conversations are in `data.jsonl` (`gen_model` field) for a longer run on a faster GPU.
- **Data used Opus + Haiku, not Opus only.** Opus at $0.0135/conversation would have cost about $27 for 2,000. The Opus share went through the Batch API at half price.
- **GPU:** GPU 0 (A16, 16 GB) of the existing box 144.202.109.109, in `/root/margaret_llm` only, `CUDA_VISIBLE_DEVICES=0`. The classifier run on GPU 1 was never touched. ufw now allows 22 and 8000; the endpoint rejects requests without the key.

## Cost

| | |
|---|---|
| Anthropic | ≈ $8.08 (Opus batch $7.06, Opus sample $0.27, Haiku $0.42, judges $0.33) |
| Vultr | $0 extra (shared the existing box; the share of a ~$0.94/h 2×A16 plan used for ~1.2 h is about $0.55) |

## Using it

`server/voice_bot.py` `make_llm()` already has an `own` brain (added by the main session). It reads `OWN_LLM_URL`, `OWN_LLM_KEY` and `OWN_LLM_MODEL`, and joins the failover chain whenever `OWN_LLM_URL` is set. To try it, put this in `.env` (the key is never written to tracked files):

```
OWN_LLM_URL=http://144.202.109.109:8000/v1
OWN_LLM_KEY=<the key from this session>
OWN_LLM_MODEL=margaret
```

Then pick the `own` brain on the dashboard. With Gemini still first, the own model works as a third failover.

**Status:** the server was stopped and port 8000 was closed after the benchmark. The merged model is still at `/root/margaret_llm/merged`. To bring it back: `ufw allow 8000/tcp`, then `MARGARET_KEY=... bash /root/margaret_llm/serve.sh` (about 2 minutes to load).

Rerun:
```
.venv/Scripts/python experiments/margaret_llm/build_data.py --n 2000 --offset 0 --limit 900 --batch      # Opus share
.venv/Scripts/python experiments/margaret_llm/build_data.py --n 2000 --offset 900 --limit 1060 --model claude-haiku-5-5
# on the GPU box, in /root/margaret_llm with venv (uv pip install vllm peft accelerate):
bash train.sh data_opus.jsonl            # -> /root/margaret_llm/merged
MARGARET_KEY=... bash serve.sh
.venv/Scripts/python scripts/bench_margaret.py --caller replay --n 40 --provider openai \
    --base-url http://144.202.109.109:8000/v1 --api-key KEY --model margaret --out-dir experiments/margaret_llm/bench_own
.venv/Scripts/python experiments/margaret_llm/latency.py --base-url http://144.202.109.109:8000/v1 --api-key KEY
```
