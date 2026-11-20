"""The browser (frontend/js/triage.js) and the API (crisis.py) must agree on what is a crisis."""
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from crisis import analyze_crisis  # noqa: E402

CASES = [
    "I want to kill myself", "I feel like nobody would notice if I was gone", "ab jeena nahi chahta",
    "cutting-edge research", "I can’t take it anymore", "seniors are ragging me", "I'm stressed about endsems",
    "everyone would be better off without me", "this is goodbye", "I feel hopeless", "is there a suicide prevention week",
    "I hurt myself last night", "nobody cares", "I won't be around much longer", "I miss home",
]


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_js_and_python_triage_agree():
    script = (
        "global.window={};require(process.argv[1]);"
        "const cases=JSON.parse(process.argv[2]);"
        "console.log(JSON.stringify(cases.map(c=>window.Triage.analyze(c).isCrisis)))"
    )
    out = subprocess.run(
        ["node", "-e", script, str(ROOT / "frontend/js/triage.js"), json.dumps(CASES)],
        capture_output=True, text=True, check=True,
    ).stdout
    js = json.loads(out)
    py = [analyze_crisis(c).is_crisis for c in CASES]
    mismatches = [(c, j, p) for c, j, p in zip(CASES, js, py) if j != p]
    assert not mismatches, mismatches
