import sqlite3

from server.config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY, name TEXT, age INTEGER, risk_flags TEXT DEFAULT '', member_since TEXT
);
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY, customer_id INTEGER, routing TEXT, number TEXT,
  bank_name TEXT, status TEXT DEFAULT 'active', label TEXT DEFAULT '', balance REAL DEFAULT 0,
  kind TEXT DEFAULT 'Checking'
);
CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY, from_account INTEGER, to_routing TEXT, to_number TEXT,
  to_name TEXT, amount REAL, status TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS blocklist (
  id INTEGER PRIMARY KEY, routing TEXT, number TEXT, source_call_id TEXT,
  status TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS allowlist (
  routing TEXT, number TEXT, name TEXT
);
CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY, call_id TEXT, intel_json TEXT, sar_markdown TEXT, status TEXT,
  key TEXT, summary TEXT, priority TEXT, assignee TEXT, created_at TEXT, status_since TEXT,
  protected REAL DEFAULT 0, history_json TEXT DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY, ts TEXT, actor TEXT, action TEXT, details_json TEXT
);
"""


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    conn.commit()
