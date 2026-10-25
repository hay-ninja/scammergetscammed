"""Point the Twilio number's voice webhook at a URL (the Vultr server, or back to ngrok).

Usage:  .venv/Scripts/python deploy/twilio_webhook.py https://scammergetscammed.biz/voice
        .venv/Scripts/python deploy/twilio_webhook.py                # just show the current webhook
Uses TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER from .env.
"""
import re
import sys
from pathlib import Path

import httpx
from dotenv import dotenv_values

env = dotenv_values(Path(__file__).resolve().parent.parent / ".env")
sid, token = env["TWILIO_ACCOUNT_SID"], env["TWILIO_AUTH_TOKEN"]
number = "+1" + re.sub(r"\D", "", env["TWILIO_PHONE_NUMBER"])[-10:]
api = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/IncomingPhoneNumbers"

with httpx.Client(auth=(sid, token), timeout=20) as c:
    found = c.get(f"{api}.json", params={"PhoneNumber": number}).json()["incoming_phone_numbers"]
    if not found:
        sys.exit(f"{number} not found on this Twilio account")
    n = found[0]
    print(f"{number}: voice webhook is {n['voice_method']} {n['voice_url']}")
    if len(sys.argv) > 1:
        r = c.post(f"{api}/{n['sid']}.json", data={"VoiceUrl": sys.argv[1], "VoiceMethod": "POST"})
        r.raise_for_status()
        print(f"{number}: voice webhook is now POST {r.json()['voice_url']}")
