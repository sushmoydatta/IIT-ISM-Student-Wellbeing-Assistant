"""Chat/error logging and simple daily analytics.

Privacy by default: message text is NOT stored unless LOG_MESSAGE_TEXT=true.
Only metadata (timestamp, hashed session, crisis flag, severity, categories,
latency) is written. Session IDs are hashed before storage.
"""
import csv
import hashlib
import json
import logging
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import List, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

LOG_DIR = Path(os.getenv("LOG_DIR", Path(__file__).parent / "logs"))
LOG_TEXT = os.getenv("LOG_MESSAGE_TEXT", "false").lower() == "true"

CHAT_HEADERS = [
    "timestamp", "session_hash", "query", "response", "crisis_flag",
    "severity_level", "categories", "response_time", "user_locale",
]
ERROR_HEADERS = ["timestamp", "session_hash", "error_type", "error_message", "stack_trace"]


def _hash(session_id: str) -> str:
    return hashlib.sha256(session_id.encode()).hexdigest()[:12]


class ChatLogger:
    def __init__(self, base_dir: Path = LOG_DIR):
        self.base_dir = Path(base_dir)
        self.chat_log = self.base_dir / "chat_log.csv"
        self.error_log = self.base_dir / "error_log.csv"
        self.analytics_log = self.base_dir / "analytics.json"
        self._lock = threading.Lock()
        self.base_dir.mkdir(parents=True, exist_ok=True)
        for path, headers in ((self.chat_log, CHAT_HEADERS), (self.error_log, ERROR_HEADERS)):
            if not path.exists():
                with open(path, "w", newline="", encoding="utf-8") as f:
                    csv.writer(f).writerow(headers)

    def _append(self, path: Path, row: list):
        with self._lock, open(path, "a", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow(row)

    async def log_chat(
        self,
        session_id: str,
        query: str,
        response: str,
        is_crisis: bool,
        severity_level: Optional[int] = None,
        categories: Optional[List[str]] = None,
        response_time: Optional[float] = None,
        user_locale: str = "en_IN",
    ):
        try:
            self._append(self.chat_log, [
                datetime.now().isoformat(),
                _hash(session_id),
                query if LOG_TEXT else "[redacted]",
                response if LOG_TEXT else "[redacted]",
                is_crisis,
                severity_level if severity_level is not None else "",
                ",".join(categories or []),
                response_time if response_time is not None else "",
                user_locale,
            ])
            self._update_analytics(is_crisis, severity_level, categories)
        except Exception as e:  # logging must never break the chat
            logging.error("Failed to log chat: %s", e)

    async def log_error(
        self, session_id: str, error_type: str, error_message: str, stack_trace: Optional[str]
    ):
        try:
            self._append(self.error_log, [
                datetime.now().isoformat(), _hash(session_id), error_type,
                error_message, stack_trace or "",
            ])
        except Exception as e:
            logging.error("Failed to log error: %s", e)

    def _update_analytics(self, is_crisis: bool, severity: Optional[int], categories: Optional[List[str]]):
        with self._lock:
            try:
                data = json.loads(self.analytics_log.read_text(encoding="utf-8"))
            except (FileNotFoundError, json.JSONDecodeError):
                data = {"daily_stats": {}}
            today = data["daily_stats"].setdefault(datetime.now().strftime("%Y-%m-%d"), {
                "total_chats": 0, "crisis_chats": 0,
                "severity_levels": {str(i): 0 for i in range(1, 6)}, "categories": {},
            })
            today["total_chats"] += 1
            today["crisis_chats"] += int(is_crisis)
            if severity:
                today["severity_levels"][str(severity)] += 1
            for c in categories or []:
                today["categories"][c] = today["categories"].get(c, 0) + 1
            self.analytics_log.write_text(json.dumps(data, indent=2), encoding="utf-8")


chat_logger = ChatLogger()


async def log_chat(*args, **kwargs):
    """Backward-compatible wrapper."""
    await chat_logger.log_chat(*args, **kwargs)
