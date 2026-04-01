import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from routers import chat, documents, syllabus, homework, trends, calendar, courses

app = FastAPI(title="UCSD Course Agent API", version="1.0.0")

# Include Chrome extension origins so the Smart-Scrape extension can reach the API.
# In production, replace the wildcard with your deployed domain.
_default_origins = "http://localhost:3000,http://localhost:3001"
cors_origins = os.getenv("CORS_ORIGINS", _default_origins).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"chrome-extension://.*",  # Chrome Smart-Scrape extension
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router,      prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(syllabus.router,  prefix="/api")
app.include_router(homework.router,  prefix="/api")
app.include_router(trends.router,    prefix="/api")
app.include_router(calendar.router,  prefix="/api")
app.include_router(courses.router,   prefix="/api")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "UCSD Course Agent"}
