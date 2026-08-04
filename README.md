# IIT ISM Student Wellbeing Assistant

A prototype support chatbot that combines document-grounded Q&A with a rule-based crisis triage layer, built as a FastAPI backend with a lightweight JS frontend.

The goal: when a student asks a general wellbeing question, answer it using retrieved campus resources. When a message shows signs of acute distress, skip the generic answer and surface a safety response instead.

## Architecture

```
User message (frontend)
        │
        ▼
   FastAPI /chat endpoint
        │
        ▼
  Crisis triage layer (crisis.py)
        │
   ┌────┴─────┐
   │           │
 Crisis     Not flagged
   │           │
   ▼           ▼
Safety      RAG document search
response    (sentence-transformers + cosine similarity)
   │           │
   └─────┬─────┘
         ▼
   Response + chat log (logger.py)
```

- **Crisis triage** (`crisis.py`) — scans incoming messages for keyword patterns across categories (suicide risk, self-harm, immediate danger, emotional distress, abuse), each with a severity level. Flagged messages get a safety-focused response instead of going through document search.
- **Document search** (`doc_engine.py`) — embeds campus wellbeing resources with `sentence-transformers`, retrieves the closest match by cosine similarity, and asks an LLM (via Groq) to answer the user's question grounded in that document.
- **Logging** (`logger.py`) — every conversation, crisis flag, and error is logged to local CSV/JSON for basic analytics (volume, crisis frequency, category breakdown).
- **Frontend** (`frontend/`) — a plain HTML/CSS/JS chat widget that talks to the FastAPI backend.

## Setup

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# add your GROQ_API_KEY to .env

uvicorn main:app --reload
```

Open `frontend/index.html` in a browser (update `API_URL` in `chatbot.js` if your backend isn't on `localhost:8000`).

Place any campus wellbeing documents (FAQs, counseling info, resource guides) as text files in `backend/data/` — this is what the RAG layer searches over.

## Honest limitations

This is a prototype built for learning, not a deployed or clinically validated system. Worth knowing before treating it as anything more:

- **Crisis detection is keyword-based, not semantic.** It matches literal phrases (e.g. `"want to die"`, `"cutting"`). It will miss indirect language, misspellings, and anything phrased differently from the listed patterns — this is a real gap, not a minor one, given what's at stake if it misses something.
- **Safety responses are generic**, not localized to specific helplines or connected to real campus counseling escalation.
- **Conversations are logged in plaintext** to local CSV files with no encryption or access control — not appropriate for handling real sensitive disclosures as-is.
- **No human-in-the-loop escalation.** A real deployment would need a path to alert an actual counselor, not just return a text response.

None of this makes the architecture pattern (triage → route to safety response or RAG → log) a bad one to have built and learned from — it's a reasonable structure. It just isn't production-ready, and I'd rather say that here than have someone find out the hard way.

## Project structure

```
IIT-ISM-Student-Wellbeing-Assistant/
├── backend/
│   ├── main.py           # FastAPI app, /chat endpoint
│   ├── crisis.py          # Keyword-based crisis detection + safety responses
│   ├── doc_engine.py       # RAG: embeddings, similarity search, LLM query
│   ├── logger.py           # Chat/error logging + basic analytics
│   ├── models.py            # Pydantic request/response schemas
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── chatbot.js
│   └── style.css
├── .gitignore
├── LICENSE
└── README.md
```

## What I'd do next

- Replace keyword matching with a fine-tuned or few-shot classifier for crisis detection
- Add real, localized helpline info and a human escalation path
- Encrypt logs at rest and add a retention/deletion policy
- Expand the document set and evaluate retrieval quality properly (not just top-1 cosine match)

## License

MIT
