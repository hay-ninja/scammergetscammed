#!/usr/bin/env bash
# Serve the merged Margaret model as an OpenAI-compatible API on port 8000 (GPU 0 only).
# Usage on the GPU box:  MARGARET_KEY=<random secret> bash serve.sh
# Client side: base_url http://<ip>:8000/v1, model "margaret", api key = $MARGARET_KEY
# Firewall: only 22 and 8000 open (ufw allow 8000/tcp).
set -euo pipefail
: "${MARGARET_KEY:?set MARGARET_KEY}"
cd /root/margaret_llm && . venv/bin/activate
CUDA_VISIBLE_DEVICES=0 nohup vllm serve /root/margaret_llm/merged \
  --served-model-name margaret \
  --api-key "$MARGARET_KEY" \
  --dtype bfloat16 \
  --max-model-len 4096 \
  --host 0.0.0.0 --port 8000 \
  --gpu-memory-utilization 0.85 \
  --enable-prefix-caching \
  > serve.log 2>&1 < /dev/null &
echo "vllm pid $!"
