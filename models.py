from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class ChatRequest(BaseModel):
    session_id: str = Field(..., description="Unique identifier for the chat session")
    query: str = Field(..., min_length=1, max_length=2000)
    user_locale: Optional[str] = Field(default="en_US")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)

class ChatResponse(BaseModel):
    response: str

class LogEntry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    session_id: str
    query: str
    response: str
    is_crisis: bool
    severity_level: Optional[int] = None
    categories: Optional[List[str]] = None
    response_time: Optional[float] = None
    user_locale: str = "en_US"
    model_used: str = "groq"
