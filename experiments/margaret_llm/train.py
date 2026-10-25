"""LoRA fine-tune of a small instruct model into Margaret, then merge the adapter.

Loss is only on Margaret's (assistant) turns; the system prompt, caller lines and coaching notes are
context. Runs on the GPU box:  python train.py --data data.jsonl --out /root/margaret-merged
"""
import argparse
import json
import math
import random
import time

import torch
from peft import LoraConfig, get_peft_model
from transformers import (AutoModelForCausalLM, AutoTokenizer, DataCollatorForSeq2Seq, Trainer,
                          TrainingArguments)


def encode(msgs, tok, max_len):
    """Token ids for the whole chat, with labels set only on assistant replies."""
    ids, labels = [], []
    prev = ""
    for i, m in enumerate(msgs):
        if m["role"] == "assistant":
            head = tok.apply_chat_template(msgs[:i], tokenize=False, add_generation_prompt=True) if i else ""
            full = tok.apply_chat_template(msgs[: i + 1], tokenize=False)
            ctx, reply = head[len(prev):], full[len(head):]
            assert full.startswith(head) and head.startswith(prev), "chat template is not prefix-stable"
            c = tok(ctx, add_special_tokens=False)["input_ids"]
            r = tok(reply, add_special_tokens=False)["input_ids"]
            # The first line ("Hello? Is this about my computer?") is fixed, so don't train on it.
            ids += c + r
            labels += [-100] * len(c) + (r if i > 1 else [-100] * len(r))
            prev = full
    return {"input_ids": ids[:max_len], "labels": labels[:max_len], "attention_mask": [1] * min(len(ids), max_len)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="Qwen/Qwen3-4B-Instruct-2507")
    ap.add_argument("--data", default="data.jsonl")
    ap.add_argument("--out", default="/root/margaret-merged")
    ap.add_argument("--epochs", type=float, default=2)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--rank", type=int, default=16)
    ap.add_argument("--max-len", type=int, default=2048)
    ap.add_argument("--bs", type=int, default=2)
    ap.add_argument("--accum", type=int, default=8)
    ap.add_argument("--limit", type=int, default=None, help="use only this many conversations")
    args = ap.parse_args()

    tok = AutoTokenizer.from_pretrained(args.base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    rows = [json.loads(line) for line in open(args.data, encoding="utf-8") if line.strip()]
    random.Random(0).shuffle(rows)
    rows = rows[: args.limit]
    data = [encode(r["messages"], tok, args.max_len) for r in rows]
    n_eval = max(40, len(data) // 20)
    train, evals = data[n_eval:], data[:n_eval]
    toks = sum(len(d["input_ids"]) for d in data)
    print(f"{len(train)} train / {len(evals)} eval conversations, {toks / len(data):.0f} tokens avg")

    model = AutoModelForCausalLM.from_pretrained(args.base, torch_dtype=torch.bfloat16, attn_implementation="sdpa").cuda()
    model.gradient_checkpointing_enable()
    model.enable_input_require_grads()
    model = get_peft_model(model, LoraConfig(
        r=args.rank, lora_alpha=2 * args.rank, lora_dropout=0.05, task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]))
    model.print_trainable_parameters()

    bs, accum = args.bs, args.accum
    steps = math.ceil(len(train) / (bs * accum) * args.epochs)
    targs = TrainingArguments(
        output_dir="/root/margaret_llm/lora", per_device_train_batch_size=bs, per_device_eval_batch_size=bs,
        gradient_accumulation_steps=accum, num_train_epochs=args.epochs, learning_rate=args.lr,
        lr_scheduler_type="cosine", warmup_steps=max(1, steps // 20), bf16=True, logging_steps=10,
        eval_strategy="steps", eval_steps=max(20, steps // 6), save_strategy="no", report_to=[],
        remove_unused_columns=False, dataloader_num_workers=2)
    t0 = time.time()
    trainer = Trainer(model=model, args=targs, train_dataset=train, eval_dataset=evals,
                      data_collator=DataCollatorForSeq2Seq(tok, padding=True, label_pad_token_id=-100))
    trainer.train()
    print("final eval", trainer.evaluate(), f"train minutes {(time.time() - t0) / 60:.1f}")

    model = model.merge_and_unload()
    model.save_pretrained(args.out, safe_serialization=True)
    tok.save_pretrained(args.out)
    print("merged model saved to", args.out)


if __name__ == "__main__":
    main()
