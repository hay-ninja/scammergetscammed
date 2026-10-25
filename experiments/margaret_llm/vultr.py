"""Create / inspect / destroy the Margaret GPU box via the Vultr API.

  VULTR_API_KEY=... python experiments/margaret_llm/vultr.py create   # A40 48GB in lax, Ubuntu 24.04
  python experiments/margaret_llm/vultr.py status
  python experiments/margaret_llm/vultr.py destroy

Only touches the instance labelled "margaret-llm" (never the classifier box at 144.202.109.109).
The key is read from the environment or the untracked .env, never written anywhere.
"""
import base64
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LABEL = "margaret-llm"
PLAN, REGION = os.getenv("MARGARET_PLAN", "vcg-a40-24c-120g-48vram"), os.getenv("MARGARET_REGION", "lax")
PUBKEY = Path.home() / ".ssh" / "flow_vultr.pub"


def key() -> str:
    k = os.getenv("VULTR_API_KEY")
    if not k and (ROOT / ".env").exists():
        for line in (ROOT / ".env").read_text().splitlines():
            if line.startswith("VULTR_API_KEY="):
                k = line.split("=", 1)[1].strip()
    if not k:
        sys.exit("VULTR_API_KEY not set")
    return k


def api(method: str, path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(f"https://api.vultr.com/v2{path}", method=method,
                                 data=json.dumps(body).encode() if body else None,
                                 headers={"Authorization": f"Bearer {key()}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        raw = r.read()
    return json.loads(raw) if raw else {}


def mine() -> list[dict]:
    return [i for i in api("GET", "/instances?per_page=500")["instances"] if i["label"] == LABEL]


def create():
    if mine():
        sys.exit(f"already exists: {mine()[0]['main_ip']}")
    os_id = next(o["id"] for o in api("GET", "/os?per_page=500")["os"] if o["name"].startswith("Ubuntu 24.04") and o["arch"] == "x64")
    script = f"#!/bin/bash\nmkdir -p /root/.ssh\necho '{PUBKEY.read_text().strip()}' >> /root/.ssh/authorized_keys\nchmod 600 /root/.ssh/authorized_keys\n"
    sid = api("POST", "/startup-scripts", {"name": LABEL, "type": "boot",
                                          "script": base64.b64encode(script.encode()).decode()})["startup_script"]["id"]
    inst = api("POST", "/instances", {"region": REGION, "plan": PLAN, "os_id": os_id, "label": LABEL,
                                      "hostname": LABEL, "script_id": sid})["instance"]
    print(json.dumps({k: inst[k] for k in ("id", "main_ip", "status", "plan", "region")}))


def status():
    for i in mine():
        print(json.dumps({k: i[k] for k in ("id", "main_ip", "status", "power_status", "server_status", "date_created")}))


def destroy():
    for i in mine():
        assert i["main_ip"] != "144.202.109.109"
        api("DELETE", f"/instances/{i['id']}")
        print("destroyed", i["id"], i["main_ip"])
    for s in api("GET", "/startup-scripts")["startup_scripts"]:
        if s["name"] == LABEL:
            api("DELETE", f"/startup-scripts/{s['id']}")


if __name__ == "__main__":
    {"create": create, "status": status, "destroy": destroy}[sys.argv[1]]()
