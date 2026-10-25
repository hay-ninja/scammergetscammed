import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

DB_PATH = Path(os.getenv("SGS_DB_PATH") or ROOT / "bank.db")
MODELS_DIR = ROOT / "training" / "models"
WEB_DIST = ROOT / "web" / "dist"

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER") or "(555) 010-0000"
CARTESIA_API_KEY = os.getenv("CARTESIA_API_KEY", "")
CARTESIA_VOICE_ID = os.getenv("CARTESIA_VOICE_ID", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
NGROK_DOMAIN = os.getenv("NGROK_DOMAIN", "")
STEPFUN_API_KEY = os.getenv("STEPFUN_API_KEY", "")
OWN_LLM_URL = os.getenv("OWN_LLM_URL", "")
API_KEY = os.getenv("SGS_API_KEY", "")  # required on /api/v1/* when set
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "")  # receives mule_account.blocked events
CREAO_API_KEY = os.getenv("CREAO_API_KEY", "")  # capi_ key from the agent's API Trigger page
CREAO_AGENT_ID = os.getenv("CREAO_AGENT_ID", "")
PUBLIC_URL = os.getenv("PUBLIC_URL", "")  # e.g. https://scammergetscammed.biz, for CREAO's run webhook
NESSIE_API_KEY = os.getenv("NESSIE_API_KEY", "")

# Gate thresholds (see PRD 6.4)
# Tuned by training/tune_gate.py on validation calls with zero false blocks on 1,173 legitimate calls
# (held-out: 16/17 scam calls caught vs 14/17 at the old 2 / 0.95 / 0.3). See training/models/gate_tuning.json.
GATE_MIN_PRESSURE_STAGES = 1
GATE_MIN_SCAM_SCORE = 0.90
STAGE_SEEN_MIN_PROB = 0.2  # a stage counts as heard when the classifier gives it this much probability
