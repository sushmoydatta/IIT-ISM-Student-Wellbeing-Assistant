from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=4000)


class ChatRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=100)
    query: str = Field(..., min_length=1, max_length=2000)
    user_locale: Optional[str] = Field(default="en_IN", max_length=20)
    history: List[Turn] = Field(default_factory=list, max_length=20)


class ChatResponse(BaseModel):
    response: str
    is_crisis: bool = False
    severity: int = 0
    categories: List[str] = Field(default_factory=list)
    sources: List[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    version: str
    extra: Dict[str, str] = Field(default_factory=dict)
