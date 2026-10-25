#!/usr/bin/env bash
# Launch the LoRA run on GPU 0 only (GPU 1 belongs to the classifier fine-tune). Usage: bash train.sh <data.jsonl>
cd /root/margaret_llm && . venv/bin/activate
CUDA_VISIBLE_DEVICES=0 PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True \
  nohup python train.py --data "${1:-data_opus.jsonl}" --out /root/margaret_llm/merged --epochs 1 --bs 2 --accum 8 --max-len 2048 \
  > train.log 2>&1 < /dev/null &
echo "started pid $!"
