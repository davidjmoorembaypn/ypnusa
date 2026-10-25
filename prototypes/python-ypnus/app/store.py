"""SQLite store for leads and zip-code claims.

SQLite keeps the prototype dependency-free. On AWS, point YPN_DATA_DIR at a mounted EFS
volume (or swap this module for DynamoDB/RDS): nothing else in the app touches storage.
"""

from __future__ import annotations

import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

_lock = threading.Lock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    nmls TEXT,
    plan_interest TEXT,
    source TEXT
);
CREATE INDEX IF NOT EXISTS leads_email ON leads (email);
CREATE TABLE IF NOT EXISTS zip_claims (
    zip_code TEXT PRIMARY KEY,
    claimed_at TEXT NOT NULL,
    claimed_by_email TEXT NOT NULL
);
"""


def data_dir() -> Path:
    path = Path(os.environ.get("YPN_DATA_DIR", "./data"))
    path.mkdir(parents=True, exist_ok=True)
    return path


@contextmanager
def connect():
    with _lock:
        conn = sqlite3.connect(data_dir() / "ypnus.sqlite3", timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.executescript(SCHEMA)
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def zip_is_claimed(zip_code: str) -> bool:
    with connect() as conn:
        row = conn.execute("SELECT 1 FROM zip_claims WHERE zip_code = ?", (zip_code,)).fetchone()
    return row is not None


def add_lead(
    *, name: str, email: str, zip_code: str, nmls: str, plan_interest: str, source: str
) -> int:
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO leads (created_at, name, email, zip_code, nmls, plan_interest, source)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (_now(), name, email.lower(), zip_code, nmls, plan_interest, source),
        )
        return int(cur.lastrowid)


def claim_zip(zip_code: str, email: str) -> bool:
    """Atomically claim a zip code. Returns False if someone already holds it."""
    with connect() as conn:
        cur = conn.execute(
            "INSERT OR IGNORE INTO zip_claims (zip_code, claimed_at, claimed_by_email)"
            " VALUES (?, ?, ?)",
            (zip_code, _now(), email.lower()),
        )
        return cur.rowcount == 1


def count_leads() -> int:
    with connect() as conn:
        return int(conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0])
