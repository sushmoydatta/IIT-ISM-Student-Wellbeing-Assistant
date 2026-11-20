import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

client = TestClient(main.app)


def test_health():
    assert client.get("/").json()["status"] == "operational"


def test_crisis_path_needs_no_llm():
    r = client.post("/chat", json={"session_id": "t1", "query": "I want to kill myself"})
    body = r.json()
    assert r.status_code == 200 and body["is_crisis"] and "14416" in body["response"]


def test_validation():
    assert client.post("/chat", json={"session_id": "t1", "query": ""}).status_code == 422
