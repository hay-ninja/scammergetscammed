"""Export the fine-tuned model to int8 ONNX so the laptop can run it with onnxruntime, without torch.

Run on the GPU box after train_transformer.py:
  pip install onnx onnxruntime
  python training/export_onnx.py
Copy back: scp -r root@<vultr-ip>:~/scammergetscammed/training/models/finetuned_onnx training/models/
"""
import json
import shutil
import sys
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from onnxruntime.quantization import QuantType, quantize_dynamic
from transformers import AutoModelForSequenceClassification, AutoTokenizer

sys.path.insert(0, str(Path(__file__).parent))
from common import MODELS  # noqa: E402

SRC, OUT = MODELS / "finetuned", MODELS / "finetuned_onnx"


def main() -> None:
    global SRC
    if len(sys.argv) > 1:  # export another run, e.g. `export_onnx.py base_v3`
        SRC = MODELS / sys.argv[1]
    tok = AutoTokenizer.from_pretrained(SRC)
    model = AutoModelForSequenceClassification.from_pretrained(SRC, attn_implementation="eager").eval().float().cpu()
    OUT.mkdir(parents=True, exist_ok=True)
    sample = tok(["mrs wilson this is agent miller [SEP] wire your savings to the protected account"], return_tensors="pt")
    fp32 = OUT / "model_fp32.onnx"
    torch.onnx.export(model, (sample["input_ids"], sample["attention_mask"]), fp32,
                      input_names=["input_ids", "attention_mask"], output_names=["logits"],
                      dynamic_axes={"input_ids": {0: "b", 1: "t"}, "attention_mask": {0: "b", 1: "t"}, "logits": {0: "b"}},
                      opset_version=17, dynamo=False)
    quantize_dynamic(fp32, OUT / "model.onnx", weight_type=QuantType.QInt8)
    fp32.unlink()
    for f in Path(OUT).glob("*.data"):
        f.unlink()
    tok.save_pretrained(OUT)
    (OUT / "labels.json").write_text(json.dumps([model.config.id2label[i] for i in range(model.config.num_labels)]))

    # Check the int8 model agrees with the original.
    sess = ort.InferenceSession(str(OUT / "model.onnx"), providers=["CPUExecutionProvider"])
    texts = ["mrs wilson this is agent miller with the federal reserve", "hi grandma its emma how is biscuit",
             "the routing number is five seven two one zero nine zero eight six", "dont tell anyone at the bank"]
    agree, t0 = 0, time.time()
    for t in texts:
        enc = tok(t, return_tensors="np", truncation=True, max_length=192)
        onnx_logits = sess.run(None, {"input_ids": enc["input_ids"].astype(np.int64),
                                      "attention_mask": enc["attention_mask"].astype(np.int64)})[0]
        with torch.no_grad():
            pt_logits = model(**tok(t, return_tensors="pt", truncation=True, max_length=192)).logits.numpy()
        agree += int(onnx_logits.argmax() == pt_logits.argmax())
    print(f"int8 agrees with fp32 on {agree}/{len(texts)}; {(time.time() - t0) * 1000 / len(texts):.0f} ms per text (both models)")
    print("size MB:", round(sum(f.stat().st_size for f in OUT.iterdir()) / 1e6, 1), [f.name for f in OUT.iterdir()])
    shutil.copy(MODELS / f"{SRC.name}_metrics.json", OUT / "metrics.json")


if __name__ == "__main__":
    main()
