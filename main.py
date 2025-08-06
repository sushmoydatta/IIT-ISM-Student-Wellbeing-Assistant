import os
import time
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from models import ChatRequest, ChatResponse
from crisis import analyze_crisis, generate_safety_response
from logger import log_chat
from doc_engine import query_documents
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

load_dotenv()

app = FastAPI(
    title="Mental Health Support Chatbot",
    description="IIT ISM's AI-powered mental health support system",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "message": "Welcome to the IIT ISM's Mental Health Chatbot!",
        "version": "2.0.0",
        "status": "operational"
    }

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    start_time = time.time()
    try:
        # Analyze for crisis
        analysis = analyze_crisis(request.query)
        is_crisis = analysis.is_crisis
        severity = analysis.severity.value if is_crisis else 0
        categories = analysis.categories if is_crisis else []
        # Main response: doc search or safety msg
        if is_crisis:
            response = generate_safety_response(analysis)
        else:
            response = await query_documents(request.query, request.context)
        response_time = time.time() - start_time
        await log_chat(
            session_id=request.session_id,
            query=request.query,
            response=response,
            is_crisis=is_crisis,
            severity_level=severity if is_crisis else None,
            categories=categories if is_crisis else None,
            response_time=response_time,
            user_locale=request.user_locale,
            model_used="groq"
        )
        return {"response": response}
    except Exception as e:
        await log_chat(
            session_id=request.session_id,
            query=request.query,
            response=str(e),
            is_crisis=False,
            error=True
        )
        raise HTTPException(status_code=500, detail=str(e))

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
