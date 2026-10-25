#!/usr/bin/env bash
# Runs ON the Vultr server (Ubuntu 22.04/24.04), from deploy/push.sh. Safe to re-run.
set -euo pipefail
APP=/opt/scammergetscammed
cd "$APP"

export DEBIAN_FRONTEND=noninteractive
if ! command -v caddy >/dev/null; then
  apt-get update -qq
  apt-get install -y -qq python3 python3-venv python3-pip curl gnupg debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi

# Python deps (first run takes a few minutes: pipecat, onnxruntime)
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt

# The CREAO run webhook needs the public URL
grep -q '^PUBLIC_URL=' .env || echo 'PUBLIC_URL=https://scammergetscammed.biz' >> .env

if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 80/tcp; ufw allow 443/tcp; fi

cp deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy
cp deploy/sgs-web.service deploy/sgs-voice.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable sgs-web sgs-voice >/dev/null
systemctl restart sgs-web
sleep 4
systemctl restart sgs-voice
sleep 3
systemctl --no-pager --lines=0 status sgs-web sgs-voice caddy | grep -E "●|Active:"
curl -s -o /dev/null -w "dashboard on :8000 -> %{http_code}\n" http://127.0.0.1:8000/api/health
