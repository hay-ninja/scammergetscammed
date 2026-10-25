#!/usr/bin/env bash
# One-time setup on the Vultr GPU box (Ubuntu 24.04): firewall, Python env with vLLM + training libs.
set -euo pipefail
nvidia-smi
ufw allow 22/tcp
ufw allow 8000/tcp
ufw --force enable
apt-get update -y && apt-get install -y python3-venv tmux
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
uv venv /root/venv --python 3.12
source /root/venv/bin/activate
uv pip install vllm
uv pip install peft "datasets>=3" accelerate
python -c "import torch, vllm, peft, transformers; print(torch.__version__, vllm.__version__, peft.__version__, transformers.__version__, torch.cuda.is_available())"
