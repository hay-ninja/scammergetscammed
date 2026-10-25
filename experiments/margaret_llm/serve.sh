#!/usr/bin/env bash
# Serve the merged Margaret model as an OpenAI-compatible API on port 8000.
# Usage on the GPU box:  MARGARET_KEY=<random secret> bash serve.sh
# Client side: base_url http://<ip>:8000/v1, model "margaret", api key = $MARGARET_KEY
set -euo pipefail
: "${MARGARET_KEY:?set MARGARET_KEY}"
source /root/venv/bin/activate
exec vllm serve /root/margaret-merged \
  --served-model-name margaret \
  --api-key "$MARGARET_KEY" \
  --dtype bfloat16 \
  --max-model-len 4096 \
  --host 0.0.0.0 --port 8000 \
  --gpu-memory-utilization 0.85 \
  --enable-prefix-caching
