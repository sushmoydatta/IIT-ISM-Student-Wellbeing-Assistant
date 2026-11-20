"""Retrieval-augmented answers over the documents in backend/data/.

Documents are split into paragraph chunks, embedded once at startup, and the
top-k chunks above a similarity threshold are passed to the LLM. If nothing
relevant is found, the model is told so instead of being handed an unrelated
document.
"""
import asyncio
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from dotenv import load_dotenv
from groq import Groq
from sentence_transformers import SentenceTransformer

from logger import chat_logger

load_dotenv()

DATA_DIR = Path(__file__).parent / "data"
TOP_K = 3
MIN_SCORE = 0.30

SYSTEM_PROMPT = """You are a warm, calm wellbeing companion for students at IIT (ISM) Dhanbad.
- Listen first. Reflect back what the student feels in one short sentence before offering anything.
- Be brief: 2-5 short paragraphs at most. Plain language, no jargon, no lists longer than 4 items.
- Ground practical advice in the provided campus context. If the context doesn't cover it, say so and suggest the campus counselling centre.
- You are not a therapist and must not diagnose, prescribe, or promise confidentiality you can't guarantee.
- If the student mentions self-harm, suicide, abuse or danger, gently urge them to call Tele-MANAS (14416) or emergency services (112).
- End with a gentle, open question that invites them to keep talking, unless they are clearly done."""


def _chunk(text: str, max_chars: int = 900) -> List[str]:
    chunks, buf = [], ""
    for para in (p.strip() for p in text.split("\n\n")):
        if not para:
            continue
        if buf and len(buf) + len(para) > max_chars:
            chunks.append(buf)
            buf = ""
        buf = f"{buf}\n\n{para}" if buf else para
    if buf:
        chunks.append(buf)
    return chunks


class DocumentSearchEngine:
    def __init__(self, data_dir: Path = DATA_DIR):
        self.embedder = SentenceTransformer("all-MiniLM-L6-v2")
        api_key = os.getenv("GROQ_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not set. Copy .env.example to .env and add your key.")
        self.client = Groq(api_key=api_key)
        self.model = os.getenv("GROQ_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")

        self.chunks: List[Tuple[str, str]] = []  # (source, text)
        for path in sorted(data_dir.glob("*.md")) + sorted(data_dir.glob("*.txt")):
            for chunk in _chunk(path.read_text(encoding="utf-8")):
                self.chunks.append((path.name, chunk))
        if not self.chunks:
            raise RuntimeError(f"No .md/.txt documents found in {data_dir}")
        self.embeddings = self.embedder.encode(
            [c for _, c in self.chunks], normalize_embeddings=True
        )

    def retrieve(self, query: str) -> List[Tuple[str, str, float]]:
        q = self.embedder.encode([query], normalize_embeddings=True)[0]
        scores = self.embeddings @ q
        top = np.argsort(scores)[::-1][:TOP_K]
        return [(*self.chunks[i], float(scores[i])) for i in top if scores[i] >= MIN_SCORE]

    def _complete(self, messages: List[Dict[str, str]]) -> str:
        completion = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.5,
            max_completion_tokens=600,
        )
        return completion.choices[0].message.content.strip()

    async def answer(
        self, query: str, history: Optional[List[Dict[str, str]]] = None
    ) -> Tuple[str, Dict[str, Any]]:
        hits = await asyncio.to_thread(self.retrieve, query)
        context = (
            "\n\n---\n\n".join(text for _, text, _ in hits)
            if hits
            else "(No campus document matched this question.)"
        )
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for turn in (history or [])[-6:]:
            if turn.get("role") in ("user", "assistant") and turn.get("content"):
                messages.append({"role": turn["role"], "content": str(turn["content"])[:2000]})
        messages.append(
            {"role": "user", "content": f"Campus context:\n{context}\n\nStudent: {query}"}
        )
        try:
            reply = await asyncio.to_thread(self._complete, messages)
        except Exception as e:
            await chat_logger.log_error("SYSTEM", "LLMError", str(e), None)
            raise
        return reply, {"sources": sorted({s for s, _, _ in hits}), "top_score": hits[0][2] if hits else 0.0}


_engine: Optional[DocumentSearchEngine] = None


def get_engine() -> DocumentSearchEngine:
    global _engine
    if _engine is None:
        _engine = DocumentSearchEngine()
    return _engine


async def query_documents(
    user_query: str, history: Optional[List[Dict[str, str]]] = None
) -> Tuple[str, Dict[str, Any]]:
    return await get_engine().answer(user_query, history)
