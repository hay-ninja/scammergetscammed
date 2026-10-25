"""Sequential latency check, one request at a time: first token and full reply, Gemini vs our model.

Replays the first 6 turns of 10 benchmark transcripts (bench_gemini/bench_transcripts.jsonl) with each
model's own context, so the prefix cache behaves like a real call.
  .venv/Scripts/python experiments/margaret_llm/latency.py --base-url http://HOST:8000/v1 --api-key KEY
"""
import argparse
import json
import statistics
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import openai  # noqa: E402
from google import genai  # noqa: E402
from google.genai import types  # noqa: E402

from server import config  # noqa: E402
from server.persona import SYSTEM_PROMPT  # noqa: E402

HERE = Path(__file__).parent


def stream_own(c, msgs):
    t0, ft, out = time.time(), None, ""
    for ch in c.chat.completions.create(model="margaret", messages=msgs, max_tokens=120, stream=True):
        d = ch.choices[0].delta.content if ch.choices else None
        if d:
            ft = ft or time.time() - t0
            out += d
    return ft, time.time() - t0, out


def stream_gemini(g, cfg, msgs):
    hist = [types.Content(role="model" if m["role"] == "assistant" else "user", parts=[types.Part(text=m["content"])])
            for m in msgs[1:]]
    t0, ft, out = time.time(), None, ""
    for ch in g.models.generate_content_stream(model="gemini-3.5-flash-lite", contents=hist, config=cfg):
        if ch.text:
            ft = ft or time.time() - t0
            out += ch.text
    return ft, time.time() - t0, out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", required=True)
    ap.add_argument("--api-key", required=True)
    args = ap.parse_args()
    own = openai.OpenAI(base_url=args.base_url, api_key=args.api_key)
    g = genai.Client(api_key=config.GOOGLE_API_KEY)
    from pipecat.services.google.llm import _THINKING_DEFAULTS
    th = _THINKING_DEFAULTS.get("gemini-3.5-flash-lite")
    cfg = types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT, max_output_tokens=120,
                                      thinking_config=types.ThinkingConfig(**th) if th else None)
    from server.persona import coach
    calls = [json.loads(line) for line in (HERE / "bench_own" / "bench_transcripts.jsonl").read_text(encoding="utf-8").splitlines()][:10]
    res = {"own": [], "gemini": []}
    for call in calls:
        callers = [t["text"] for t in call["transcript"] if t["speaker"] == "caller"][:6]
        for name in res:
            msgs = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "assistant", "content": call["transcript"][0]["text"]}]
            for line in callers:
                msgs.append({"role": "user", "content": line + coach("Be confused and a little worried. Ask who is calling and why.")})
                ft, total, out = stream_own(own, msgs) if name == "own" else stream_gemini(g, cfg, msgs)
                res[name].append((ft, total, len(out.split())))
                msgs.append({"role": "assistant", "content": out})
    summary = {}
    for name, xs in res.items():
        ft = sorted(x[0] for x in xs)
        tot = sorted(x[1] for x in xs)
        summary[name] = {"n": len(xs), "first_token_p50": round(statistics.median(ft), 3),
                         "first_token_p95": round(ft[int(0.95 * (len(ft) - 1))], 3),
                         "full_reply_p50": round(statistics.median(tot), 3),
                         "full_reply_p95": round(tot[int(0.95 * (len(tot) - 1))], 3),
                         "words_avg": round(statistics.mean(x[2] for x in xs), 1)}
    print(json.dumps(summary, indent=2))
    (HERE / "latency.json").write_text(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
