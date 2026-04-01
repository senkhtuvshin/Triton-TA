"""
PDF parsing and chunking service.
Chunks by semantic boundaries (paragraphs) with overlap to preserve
mathematical context (theorem + proof stay together).
"""
import os
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter


def parse_and_chunk_pdf(file_path: str, course_id: str) -> list[dict]:
    reader = PdfReader(file_path)
    full_text = ""
    for page_num, page in enumerate(reader.pages):
        page_text = page.extract_text() or ""
        full_text += f"\n[PAGE {page_num + 1}]\n{page_text}"

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=150,
        separators=["\n\n", "\n", ". ", " "],
    )
    chunks = splitter.split_text(full_text)

    return [
        {
            "text": chunk,
            "metadata": {
                "course_id": course_id,
                "source_file": os.path.basename(file_path),
                "chunk_index": i,
            },
        }
        for i, chunk in enumerate(chunks)
    ]
