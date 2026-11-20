import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from crisis import SeverityLevel, analyze_crisis, generate_safety_response  # noqa: E402


@pytest.mark.parametrize("text", [
    "I want to kill myself",
    "honestly i've been feeling suicidal",
    "I just want to end it all",
    "I can’t take it anymore",  # curly apostrophe
    "I've been self harming again",
    "I keep cutting myself",
    "seniors are ragging me every night",
    "this is goodbye",
    "I don't want to be alive",
    "I feel like nobody would notice if I was gone",
    "I won't be around much longer",
    "everyone would be better off without me",
    "ab jeena nahi chahta",
])
def test_flags_crisis(text):
    assert analyze_crisis(text).is_crisis


@pytest.mark.parametrize("text", [
    "I'm stressed about my endsem",
    "cutting-edge research in ML makes me anxious",
    "how do I book a counselling session",
    "I feel homesick",
])
def test_non_crisis(text):
    assert not analyze_crisis(text).is_crisis


def test_moderate_not_crisis():
    a = analyze_crisis("sometimes it feels like nobody cares")
    assert a.severity == SeverityLevel.MODERATE and not a.is_crisis


def test_critical_response_mentions_emergency():
    r = generate_safety_response(analyze_crisis("I have a plan to die"))
    assert "112" in r and "14416" in r


def test_categories_sorted_by_priority():
    a = analyze_crisis("I can't take it anymore and I want to kill myself")
    assert a.categories[0] == "suicide"


def test_any_mention_of_suicide_is_flagged():
    # Known limitation, kept on purpose: keyword triage errs on the side of safety.
    assert analyze_crisis("is there a suicide prevention week?").is_crisis
