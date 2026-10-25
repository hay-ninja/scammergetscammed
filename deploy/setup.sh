#!/bin/bash
# One-time (and re-runnable) setup on an Ubuntu 24.04 server. Expects /root/sgs.tar built by deploy/push.sh:
# the git tree + web/dist + .env + training/models (int8 ONNX) + training/data/creao_runs.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

if ! command -v caddy >/dev/null; then
  apt-get update -q
  apt-get install -y -q python3-venv python3-pip curl debian-keyring debian-archive-keyring apt-transport-https gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q && apt-get install -y -q caddy
fi

mkdir -p /opt/sgs
tar -xf /root/sgs.tar -C /opt/sgs
cd /opt/sgs
grep -q '^PUBLIC_URL=' .env && sed -i 's#^PUBLIC_URL=.*#PUBLIC_URL=https://scammergetscammed.biz#' .env || echo 'PUBLIC_URL=https://scammergetscammed.biz' >> .env

[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt

cp deploy/sgs-server.service deploy/sgs-voice.service /etc/systemd/system/
cp deploy/Caddyfile /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable -q sgs-server sgs-voice caddy
systemctl restart sgs-server sgs-voice
systemctl reload caddy || systemctl restart caddy
sleep 8
systemctl --no-pager --lines=0 status sgs-server sgs-voice caddy | grep -E '●|Active:'
