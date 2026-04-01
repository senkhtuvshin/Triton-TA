#!/usr/bin/env python3
"""
CLI tool for ingesting a PDF into the ChromaDB vector store.

Usage:
    cd backend
    python scripts/ingest_pdf.py <path_to_pdf> <course_id>

Example:
    python scripts/ingest_pdf.py ~/Downloads/math20c_lecture3.pdf math20c
"""
import sys
import os

# Allow imports from the backend root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from services.pdf_service import parse_and_chunk_pdf
from services.rag_service import add_chunks


def main():
    if len(sys.argv) < 3:
        print("Usage: python scripts/ingest_pdf.py <path_to_pdf> <course_id>")
        print("  course_id: math20c | cse12")
        sys.exit(1)

    pdf_path = sys.argv[1]
    course_id = sys.argv[2]

    if not os.path.isfile(pdf_path):
        print(f"Error: File not found: {pdf_path}")
        sys.exit(1)

    if course_id not in ("math20c", "cse12"):
        print("Error: course_id must be 'math20c' or 'cse12'")
        sys.exit(1)

    print(f"Parsing {pdf_path}...")
    chunks = parse_and_chunk_pdf(pdf_path, course_id)
    print(f"  → {len(chunks)} chunks extracted")

    print(f"Indexing into ChromaDB collection 'course_{course_id}'...")
    n = add_chunks(course_id, chunks)
    print(f"  → {n} chunks indexed successfully")
    print("Done.")


if __name__ == "__main__":
    main()
