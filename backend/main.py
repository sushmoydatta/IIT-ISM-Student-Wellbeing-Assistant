import logging
import os
import time
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from crisis import analyze_crisis, generate_safety_response
from logger import chat_logger
from models import ChatRequest, ChatResponse, HealthResponse

load_dotenv()

VERSION = "3.0.0"

app = FastAPI(
    title="Sukoon: IIT ISM Student Wellbeing Assistant",
    description="Crisis triage + retrieval-grounded support chatbot (prototype).",
    version=VERSION,
)

# Comma-separated list, e.g. "https://<user>.github.io,http://localhost:5500"
origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/", response_model=HealthResponse)
def health():
    return HealthResponse(status="operational", version=VERSION)


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    start = time.perf_counter()
    analysis = analyze_crisis(request.query)
    sources: list = []
    try:
        if analysis.is_crisis:
            response = generate_safety_response(analysis)
        else:
            # Imported lazily so the crisis path works even if the model or API key is unavailable.
            from doc_engine import query_documents

            response, meta = await query_documents(
                request.query, [t.model_dump() for t in request.history]
            )
            sources = meta.get("sources", [])
    except Exception as e:
        error_id = uuid.uuid4().hex[:8]
        logging.exception("chat failed (%s)", error_id)
        await chat_logger.log_error(request.session_id, type(e).__name__, f"[{error_id}] {e}", None)
        raise HTTPException(
            status_code=503,
            detail=f"The assistant is having trouble right now (ref {error_id}). "
            "If you need to talk to someone now, call Tele-MANAS on 14416.",
        )

    await chat_logger.log_chat(
        session_id=request.session_id,
        query=request.query,
        response=response,
        is_crisis=analysis.is_crisis,
        severity_level=analysis.severity.value or None,
        categories=analysis.categories or None,
        response_time=round(time.perf_counter() - start, 3),
        user_locale=request.user_locale or "en_IN",
    )
    return ChatResponse(
        response=response,
        is_crisis=analysis.is_crisis,
        severity=analysis.severity.value,
        categories=analysis.categories,
        sources=sources,
    )
