"""Rule-based crisis triage.

Messages are normalised (lower-case, curly quotes straightened, whitespace
collapsed) and matched against whole-word regex patterns. This is still
keyword matching: it reduces false positives like "cutting-edge" and catches
common spelling variants, but it cannot understand indirect language.

The same pattern list lives in frontend/js/triage.js for the in-browser demo.
Keep the two in sync.
"""
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Tuple


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
    patterns: List[Tuple[str, SeverityLevel]]
    response_priority: int
    compiled: List[Tuple[re.Pattern, SeverityLevel]] = field(init=False)

    def __post_init__(self):
        self.compiled = [(re.compile(rf"\b(?:{p})\b"), s) for p, s in self.patterns]


@dataclass
class CrisisAnalysis:
    is_crisis: bool
    severity: SeverityLevel
    categories: List[str]
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


S = SeverityLevel
CRISIS_CATEGORIES: Dict[str, CrisisCategory] = {
    "suicide": CrisisCategory(
        "suicide",
        [
            (r"kill(?:ing)? myself", S.CRITICAL),
            (r"end(?:ing)? (?:my|it all|my own) life|end it all", S.CRITICAL),
            (r"suicid(?:e|al)", S.CRITICAL),
            (r"plan(?:ning)? to die", S.CRITICAL),
            (r"(?:want|wanna|going) to die", S.SEVERE),
            (r"better off dead|better off without me", S.SEVERE),
            (r"no reason to live|don'?t want to (?:live|be alive|exist)", S.SEVERE),
            (r"wish i (?:was|were) dead|wish i wasn'?t (?:here|alive)", S.SEVERE),
            (r"(?:nobody|no one|no-one) would (?:notice|care|miss me) if i(?:'?m| was| were) gone|if i (?:was|were) gone|when i'?m gone", S.SEVERE),
            (r"won'?t be (?:around|here|a problem) (?:much )?(?:longer|for long)|(?:everyone|they)(?:'?d| would) be (?:better|happier) without me", S.SEVERE),
            (r"jeena nahi (?:chahta|chahti)|mar jana (?:chahta|chahti)|marna (?:chahta|chahti)", S.SEVERE),
        ],
        response_priority=1,
    ),
    "self_harm": CrisisCategory(
        "self_harm",
        [
            (r"cut(?:ting)? myself|cutting my (?:arms?|wrists?|legs?)", S.HIGH),
            (r"self[- ]?harm(?:ing)?", S.HIGH),
            (r"hurt(?:ing)? myself", S.HIGH),
            (r"burn(?:ing)? myself", S.HIGH),
            (r"bleed out|overdose|od on", S.SEVERE),
        ],
        response_priority=2,
    ),
    "immediate_danger": CrisisCategory(
        "immediate_danger",
        [
            (r"goodbye forever|this is goodbye", S.CRITICAL),
            (r"(?:my )?(?:last|suicide) note", S.CRITICAL),
            (r"final message", S.CRITICAL),
        ],
        response_priority=1,
    ),
    "emotional_distress": CrisisCategory(
        "emotional_distress",
        [
            (r"completely hopeless|no hope left", S.HIGH),
            (r"can'?t (?:take|do) (?:it|this) anymore", S.SEVERE),
            (r"everything is pointless|nothing matters anymore", S.HIGH),
            (r"unbearable pain", S.SEVERE),
            (r"want (?:it|everything) to (?:end|stop)", S.SEVERE),
            (r"nobody (?:cares|would notice)", S.MODERATE),
        ],
        response_priority=3,
    ),
    "abuse": CrisisCategory(
        "abuse",
        [
            (r"being (?:abused|hurt|beaten|harassed)", S.SEVERE),
            (r"(?:he|she|they) (?:threatens?|hits?|beats?) me", S.SEVERE),
            (r"afraid for my life|scared for my life", S.CRITICAL),
            (r"domestic violence|sexual(?:ly)? (?:assault|abuse)d?", S.CRITICAL),
            (r"ragg(?:ed|ing)", S.HIGH),  # ragging: hostel hazing, common in Indian campuses
        ],
        response_priority=2,
    ),
}


def normalise(text: str) -> str:
    text = text.lower().replace("’", "'").replace("‘", "'")
    return re.sub(r"\s+", " ", text)


def analyze_crisis(text: str) -> CrisisAnalysis:
    text = normalise(text)
    max_severity = SeverityLevel.NONE
    found: List[CrisisCategory] = []
    for category in CRISIS_CATEGORIES.values():
        for pattern, severity in category.compiled:
            if pattern.search(text):
                if severity.value > max_severity.value:
                    max_severity = severity
                if category not in found:
                    found.append(category)
    found.sort(key=lambda c: c.response_priority)
    return CrisisAnalysis(
        is_crisis=max_severity.value >= SeverityLevel.HIGH.value,
        severity=max_severity,
        categories=[c.name for c in found],
    )


HELPLINES = (
    "You can reach someone right now:\n"
    "- Tele-MANAS (Govt. of India, 24x7, free): 14416 or 1-800-891-4416\n"
    "- Emergency: 112\n"
    "- iCall (TISS, Mon-Sat 10am-8pm): 9152987821\n"
    "- IIT ISM Counselling Centre, via the institute website or the Dean of Students' office"
)

CATEGORY_RESPONSES = {
    "suicide": "I'm really glad you told me. What you're feeling matters, and you deserve support from a real person right now.",
    "self_harm": "Thank you for trusting me with this. You don't have to handle it alone, and talking to someone can help, even today.",
    "immediate_danger": "I'm worried about your safety right now. Please reach out to someone immediately.",
    "emotional_distress": "That sounds incredibly heavy. Feeling this way doesn't mean you're weak; it means you've been carrying a lot.",
    "abuse": "No one has the right to hurt or threaten you. You deserve to be safe, and there are people who can help.",
}


def generate_safety_response(analysis: CrisisAnalysis) -> str:
    parts: List[str] = []
    if analysis.severity == SeverityLevel.CRITICAL:
        parts.append("If you are in immediate danger, please call 112 now.")
    parts += [CATEGORY_RESPONSES[c] for c in analysis.categories if c in CATEGORY_RESPONSES]
    parts.append(HELPLINES)
    parts.append("I'm still here if you want to keep talking.")
    return "\n\n".join(parts)


def contains_crisis_keywords(text: str) -> bool:
    """Backward-compatible helper."""
    return analyze_crisis(text).is_crisis
