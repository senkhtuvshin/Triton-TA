# UCSD Course Agent

A course-specific AI study assistant built for UCSD students. Each course gets its own AI tutor that knows your syllabus, tracks upcoming deadlines, and teaches using the Socratic method instead of just giving answers.

## Features

- **Socratic TA chat** — Claude-powered tutor that asks guiding questions rather than handing over solutions
- **Smart Ingest** — paste your syllabus or Canvas page text; the AI extracts deadlines, exams, and assignments automatically
- **RAG over course material** — ChromaDB vector store scoped per course so answers are grounded in your actual content
- **Midterm countdown** — live countdown to your next exam pulled from ingested syllabus data
- **Progress tracking** — logs errors and recovery plans so you can review what you've struggled with

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS |
| Backend | Python FastAPI, streaming SSE |
| AI | Anthropic Claude (`claude-sonnet-4-6`) |
| RAG | ChromaDB + sentence-transformers embeddings |
| Auth / DB | Supabase (optional — runs fully local without it) |

## Project Structure

```
.
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── routers/                 # API route handlers
│   ├── services/
│   │   ├── rag_service.py       # ChromaDB retrieval
│   │   └── countdown_service.py # Exam countdown logic
│   ├── models/
│   │   └── prompts.py           # Socratic TA system prompt
│   └── data/syllabi/            # Seeded exam dates (JSON)
└── frontend/
    ├── app/                     # Next.js App Router pages
    ├── components/              # UI components
    └── lib/
        └── CourseContext.tsx    # Course selection state
```

## Running Locally

**Prerequisites:** Python 3.10+, Node 18+, an [Anthropic API key](https://console.anthropic.com/)

```bash
# 1. Clone and set up environment
git clone https://github.com/YOUR_USERNAME/course-agent.git
cd course-agent

# 2. Backend
cp .env.example backend/.env
# Edit backend/.env and add your ANTHROPIC_API_KEY
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload   # runs on http://localhost:8000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                 # runs on http://localhost:3000
```

## How It Works

1. Add a course (e.g. MATH 20C) in the sidebar
2. Paste your Canvas syllabus text into Smart Ingest — the backend calls Claude to extract structured deadline data and stores it in ChromaDB
3. Open "Chat with TA" and ask a question — the backend retrieves relevant chunks from ChromaDB, injects them into the system prompt, and streams a Socratic response back
4. The sidebar shows a live countdown to your next midterm and suggested practice topics based on logged errors
