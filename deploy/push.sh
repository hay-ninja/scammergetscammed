#!/bin/bash
# Ship the current commit to the production server and restart it (run from the repo root, in Git Bash).
#   bash deploy/push.sh            # default host: the Vultr box behind scammergetscammed.biz
# Packs the git tree + web/dist + .env + the int8 model + saved CREAO runs, uploads, runs deploy/setup.sh.
set -euo pipefail
HOST="${1:-root@144.202.109.109}"
KEY="${SGS_SSH_KEY:-$HOME/.ssh/flow_vultr}"
npm --prefix web run build >/dev/null
rm -f /tmp/sgs.tar
git archive --format=tar -o /tmp/sgs.tar HEAD
tar -rf /tmp/sgs.tar web/dist .env training/models/finetuned_onnx training/models/baseline.joblib training/models/*.json training/data/creao_runs
scp -i "$KEY" -q /tmp/sgs.tar deploy/setup.sh "$HOST":/root/
ssh -i "$KEY" "$HOST" 'bash /root/setup.sh'
curl -s -m 20 https://scammergetscammed.biz/api/health && echo
