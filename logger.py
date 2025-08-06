import os
import csv
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class ChatLogger:
    def __init__(self):
        self.base_dir = Path("logs")
        self.chat_log = self.base_dir / "chat_log.csv"
        self.error_log = self.base_dir / "error_log.csv"
        self.analytics_log = self.base_dir / "analytics.json"
        self._initialize_directories()

    def _initialize_directories(self):
        self.base_dir.mkdir(exist_ok=True)
        for log_file in [self.chat_log, self.error_log]:
            if not log_file.exists():
                log_file.parent.mkdir(exist_ok=True)
                self._create_log_file(log_file)

    def _create_log_file(self, file_path: Path):
        headers = {
            "chat_log.csv": [
                "timestamp", "session_id", "query", "response",
                "crisis_flag", "severity_level", "categories",
                "response_time", "user_locale", "model_used"
            ],
            "error_log.csv": [
                "timestamp", "session_id", "error_type",
                "error_message", "stack_trace"
            ]
        }
        if file_path.suffix == '.csv':
            with open(file_path, mode="w", newline='', encoding='utf-8') as f:
                from csv import writer
                writer = csv.writer(f)
                writer.writerow(headers[file_path.name])

    async def log_chat(
        self,
        session_id: str,
        query: str,
        response: str,
        is_crisis: bool,
        severity_level: Optional[int] = None,
        categories: Optional[List[str]] = None,
        response_time: Optional[float] = None,
        user_locale: str = "en_US",
        model_used: str = "groq",
        context: Optional[Dict[str, Any]] = None,
        error: bool = False
    ):
        timestamp = datetime.now().isoformat()
        try:
            with open(self.chat_log, mode="a", newline='', encoding='utf-8') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow([
                    timestamp,
                    session_id,
                    query,
                    response,
                    str(is_crisis),
                    severity_level if severity_level is not None else "N/A",
                    ",".join(categories) if categories else "N/A",
                    response_time,
                    user_locale,
                    model_used,
                ])
            await self._update_analytics(
                session_id=session_id,
                is_crisis=is_crisis,
                severity_level=severity_level,
                categories=categories
            )
            logging.info(f"Chat logged - Session: {session_id[:8]}... Crisis: {is_crisis}")
        except Exception as e:
            await self.log_error(
                session_id=session_id,
                error_type="LoggingError",
                error_message=str(e),
                stack_trace=None
            )
            logging.error(f"Failed to log chat: {str(e)}")

    async def log_error(
        self,
        session_id: str,
        error_type: str,
        error_message: str,
        stack_trace: Optional[str]
    ):
        timestamp = datetime.now().isoformat()
        with open(self.error_log, mode="a", newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow([
                timestamp,
                session_id,
                error_type,
                error_message,
                stack_trace or "N/A",
            ])

    async def _update_analytics(
        self,
        session_id: str,
        is_crisis: bool,
        severity_level: Optional[int],
        categories: Optional[List[str]]
    ):
        analytics = self._load_analytics()
        today = datetime.now().strftime('%Y-%m-%d')
        if today not in analytics['daily_stats']:
            analytics['daily_stats'][today] = {
                'total_chats': 0,
                'crisis_chats': 0,
                'severity_levels': {str(i): 0 for i in range(1, 6)},
                'categories': {}
            }
        analytics['daily_stats'][today]['total_chats'] += 1
        if is_crisis:
            analytics['daily_stats'][today]['crisis_chats'] += 1
        if severity_level:
            analytics['daily_stats'][today]['severity_levels'][str(severity_level)] += 1
        if categories:
            for category in categories:
                analytics['daily_stats'][today]['categories'][category] = \
                    analytics['daily_stats'][today]['categories'].get(category, 0) + 1

        with open(self.analytics_log, 'w', encoding='utf-8') as f:
            json.dump(analytics, f, indent=2)

    def _load_analytics(self) -> Dict:
        if not self.analytics_log.exists():
            return {'daily_stats': {}}
        try:
            with open(self.analytics_log, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {'daily_stats': {}}

chat_logger = ChatLogger()

# Wrapper for backward compatibility
async def log_chat(*args, **kwargs):
    await chat_logger.log_chat(*args, **kwargs)
