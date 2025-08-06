from typing import List, Dict, Tuple, Optional
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

class SeverityLevel(Enum):
    NONE = 0
    LOW = 1
    MODERATE = 2
    HIGH = 3
    SEVERE = 4
    CRITICAL = 5

@dataclass
class CrisisCategory:
    name: str
    keywords: List[Tuple[str, SeverityLevel]]
    response_priority: int

class CrisisAnalysis:
    def __init__(
        self,
        is_crisis: bool,
        severity: SeverityLevel,
        categories: List[str],
        timestamp: Optional[datetime] = None
    ):
        self.is_crisis = is_crisis
        self.severity = severity
        self.categories = categories
        self.timestamp = timestamp or datetime.utcnow()

CRISIS_CATEGORIES: Dict[str, CrisisCategory] = {
    "suicide": CrisisCategory(
        name="suicide",
        keywords=[
            ("kill myself", SeverityLevel.CRITICAL),
            ("end my life", SeverityLevel.CRITICAL),
            ("suicide", SeverityLevel.CRITICAL),
            ("want to die", SeverityLevel.SEVERE),
            ("better off dead", SeverityLevel.SEVERE),
            ("plan to die", SeverityLevel.CRITICAL),
        ],
        response_priority=1,
    ),
    "self_harm": CrisisCategory(
        name="self_harm",
        keywords=[
            ("cut myself", SeverityLevel.HIGH),
            ("cutting", SeverityLevel.HIGH),
            ("self-harm", SeverityLevel.HIGH),
            ("hurt myself", SeverityLevel.HIGH),
            ("bleed out", SeverityLevel.SEVERE),
        ],
        response_priority=2,
    ),
    "immediate_danger": CrisisCategory(
        name="immediate_danger",
        keywords=[
            ("goodbye forever", SeverityLevel.CRITICAL),
            ("last note", SeverityLevel.CRITICAL),
            ("final message", SeverityLevel.CRITICAL)
        ],
        response_priority=1,
    ),
    "emotional_distress": CrisisCategory(
        name="emotional_distress",
        keywords=[
            ("completely hopeless", SeverityLevel.HIGH),
            ("can't take it anymore", SeverityLevel.SEVERE),
            ("everything is pointless", SeverityLevel.HIGH),
            ("nobody cares", SeverityLevel.MODERATE),
            ("unbearable pain", SeverityLevel.SEVERE),
            ("want it to end", SeverityLevel.SEVERE)
        ],
        response_priority=3,
    ),
    "abuse": CrisisCategory(
        name="abuse",
        keywords=[
            ("being abused", SeverityLevel.SEVERE),
            ("threatens me", SeverityLevel.SEVERE),
            ("afraid for my life", SeverityLevel.CRITICAL),
            ("domestic violence", SeverityLevel.CRITICAL),
            ("trapped", SeverityLevel.SEVERE),
            ("being hurt", SeverityLevel.SEVERE)
        ],
        response_priority=2
    )
}

def analyze_crisis(text: str) -> CrisisAnalysis:
    text_lower = text.lower()
    max_severity = SeverityLevel.NONE
    detected_categories = []
    for category in CRISIS_CATEGORIES.values():
        for keyword, severity in category.keywords:
            if keyword in text_lower:
                if severity.value > max_severity.value:
                    max_severity = severity
                if category.name not in detected_categories:
                    detected_categories.append(category.name)
    is_crisis = max_severity.value >= SeverityLevel.HIGH.value
    return CrisisAnalysis(
        is_crisis=is_crisis,
        severity=max_severity,
        categories=detected_categories
    )

SAFETY_MESSAGE = (
    "Your feelings are important. Remember, you are not alone. "
    "If you're in crisis or need immediate help, please contact a helpline in your country."
)

CATEGORY_RESPONSES = {
    "suicide": "I'm very concerned about your safety. Please reach out to a helpline immediately.",
    "self_harm": "It's important to take care of yourself. If you feel unsafe, consider contacting a trusted person or professional.",
    "immediate_danger": "If you are in immediate danger, please seek emergency help right away.",
    "emotional_distress": "You are not alone in this. Many people go through tough times, and there are people who care and want to help.",
    "abuse": "If you are facing abuse, please consider reaching out to support services or someone you trust."
}

def generate_safety_response(analysis: CrisisAnalysis) -> str:
    responses = []
    if analysis.severity == SeverityLevel.CRITICAL:
        responses.append(
            "I'm very concerned about your immediate safety. "
            "Please call emergency services or a crisis helpline right now."
        )
    for category in analysis.categories:
        if category in CATEGORY_RESPONSES:
            responses.append(CATEGORY_RESPONSES[category])
    responses.append(SAFETY_MESSAGE)
    return "\n\n".join(responses)

def contains_crisis_keywords(text: str) -> bool:
    """For backward compatibility"""
    analysis = analyze_crisis(text)
    return analysis.is_crisis
