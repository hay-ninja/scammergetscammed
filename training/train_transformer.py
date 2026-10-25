"""Fine-tune a small transformer on the scam-stage windows. Run on the Vultr GPU box.

On the GPU box:
  pip install "transformers>=4.48" datasets accelerate scikit-learn torch
  python training/train_transformer.py                     # ModernBERT-base
  python training/train_transformer.py --model distilbert-base-uncased   # fallback

Copy back to the laptop:
  scp -r root@<vultr-ip>:~/scammergetscammed/training/models/finetuned training/models/
  scp root@<vultr-ip>:~/scammergetscammed/training/models/finetuned_metrics.json training/models/
"""
import argparse
import json
import random
import sys
import time
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import classification_report, confusion_matrix
from transformers import (AutoModelForSequenceClassification, AutoTokenizer, Trainer, TrainerCallback,
                          TrainingArguments)

sys.path.insert(0, str(Path(__file__).parent))
from common import MODELS, SCAM_STAGES, call_level, heldout_eval, load_calls, split, windows  # noqa: E402

LOG = MODELS / "train_log.jsonl"  # replaced per run in main()


class Windows(torch.utils.data.Dataset):
    def __init__(self, pairs, tok, label2id, max_len):
        texts, labels = zip(*pairs)
        self.enc = tok(list(texts), truncation=True, max_length=max_len, padding="max_length")
        self.labels = [label2id[l] for l in labels]

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, i):
        item = {k: torch.tensor(v[i]) for k, v in self.enc.items()}
        item["labels"] = torch.tensor(self.labels[i])
        return item


class JsonlLogger(TrainerCallback):
    """Writes every logged step to train_log.jsonl so the dashboard can replay the curve."""

    def on_log(self, args, state, control, logs=None, **kw):
        if logs:
            with LOG.open("a") as f:
                f.write(json.dumps({"step": state.global_step, "epoch": state.epoch, **logs}) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="answerdotai/ModernBERT-base")
    ap.add_argument("--epochs", type=float, default=3)
    ap.add_argument("--lr", type=float, default=3e-5)
    ap.add_argument("--max-len", type=int, default=192)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--out", default="finetuned", help="output folder name under training/models, for parallel runs")
    args = ap.parse_args()
    global LOG
    LOG = MODELS / f"{args.out}_train_log.jsonl"

    calls = load_calls()
    train, val, test = split(calls)
    rng = random.Random(1)
    tr = [w for c in train for w in windows(c, rng)]
    va = [w for c in val for w in windows(c)]
    te = [w for c in test for w in windows(c)]
    labels = sorted({l for _, l in tr + va + te})
    label2id = {l: i for i, l in enumerate(labels)}

    tok = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForSequenceClassification.from_pretrained(
        args.model, num_labels=len(labels), id2label=dict(enumerate(labels)), label2id=label2id)

    # Class weights so rare stages still count.
    counts = np.bincount([label2id[l] for _, l in tr], minlength=len(labels)) + 1
    weights = torch.tensor(len(tr) / (len(labels) * counts), dtype=torch.float)

    class WeightedTrainer(Trainer):
        def compute_loss(self, model, inputs, return_outputs=False, **kw):
            y = inputs.pop("labels")
            out = model(**inputs)
            loss = torch.nn.functional.cross_entropy(out.logits, y, weight=weights.to(out.logits.device))
            return (loss, out) if return_outputs else loss

    MODELS.mkdir(parents=True, exist_ok=True)
    LOG.write_text("")
    targs = TrainingArguments(
        output_dir=str(MODELS / f"{args.out}_checkpoints"), num_train_epochs=args.epochs, learning_rate=args.lr,
        per_device_train_batch_size=args.batch, gradient_accumulation_steps=max(1, 32 // args.batch),
        per_device_eval_batch_size=64, eval_strategy="epoch",
        save_strategy="no", logging_steps=10, bf16=torch.cuda.is_available(), report_to=[],
    )
    trainer = WeightedTrainer(model=model, args=targs,
                              train_dataset=Windows(tr, tok, label2id, args.max_len),
                              eval_dataset=Windows(va, tok, label2id, args.max_len),
                              callbacks=[JsonlLogger()])
    t0 = time.time()
    trainer.train()
    print(f"trained in {time.time() - t0:.0f}s")

    model.eval()
    device = model.device

    @torch.no_grad()
    def predict(text):
        enc = tok(text, truncation=True, max_length=args.max_len, return_tensors="pt").to(device)
        p = torch.softmax(model(**enc).logits[0], -1).cpu().numpy()
        stage = labels[int(p.argmax())]
        probs = {l: float(p[i]) for i, l in enumerate(labels)}
        return stage, float(sum(p[label2id[s]] for s in labels if s in SCAM_STAGES)), probs

    pred = [predict(t)[0] for t, _ in te]
    yte = [l for _, l in te]
    report = classification_report(yte, pred, output_dict=True, zero_division=0)
    print(classification_report(yte, pred, zero_division=0))
    t0 = time.time()
    cl = call_level(test, predict)
    latency = (time.time() - t0) * 1000 / max(1, len(te))
    print("call-level:", cl)
    heldout = heldout_eval(predict)
    print("held-out:", heldout)

    out = MODELS / args.out
    model.save_pretrained(out)
    tok.save_pretrained(out)
    metrics = {
        "model": f"finetuned:{args.model.split('/')[-1]}", "n_calls": len(calls), "n_train_windows": len(tr),
        "n_test_windows": len(te), "macro_f1": round(report["macro avg"]["f1-score"], 3),
        "accuracy": round(report["accuracy"], 3),
        "per_stage_f1": {k: round(v["f1-score"], 3) for k, v in report.items() if k in labels},
        "confusion": {"labels": labels, "matrix": confusion_matrix(yte, pred, labels=labels).tolist()},
        "call_level": cl, "heldout": heldout, "latency_ms_per_window": round(latency, 2), "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu",
        "train_log": [json.loads(l) for l in LOG.read_text().splitlines() if l.strip()],
    }
    (MODELS / f"{args.out}_metrics.json").write_text(json.dumps(metrics, indent=2))
    print(f"Saved {out}")


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    main()
