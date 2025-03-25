from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
from datetime import datetime
from sqlalchemy.orm import Session
from models import SessionLocal, Document
import ai_service  # Import the AI service module
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # SvelteKit default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models


class DocumentBase(BaseModel):
    id: str
    title: str
    content: str
    created_at: datetime
    updated_at: datetime


class Plotline(BaseModel):
    id: str
    title: str
    description: str
    created_at: datetime


# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
async def root():
    return {"message": "AI Writer API"}


@app.get("/documents")
async def get_documents(db: Session = Depends(get_db)):
    documents = db.query(Document).all()
    return documents


@app.post("/documents")
async def create_document(document: DocumentBase, db: Session = Depends(get_db)):
    db_document = Document(
        id=document.id,
        title=document.title,
        content=document.content,
        created_at=document.created_at,
        updated_at=document.updated_at
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document


@app.get("/documents/{document_id}")
async def get_document(document_id: str, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@app.put("/documents/{document_id}")
async def update_document(document_id: str, document: DocumentBase, db: Session = Depends(get_db)):
    db_document = db.query(Document).filter(Document.id == document_id).first()
    if db_document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    db_document.title = document.title
    db_document.content = document.content
    db_document.updated_at = document.updated_at

    db.commit()
    db.refresh(db_document)
    return db_document


@app.get("/plotlines")
async def get_plotlines():
    return list(plotlines.values())


@app.post("/plotlines")
async def create_plotline(plotline: Plotline):
    plotlines[plotline.id] = plotline
    return plotline


# AI endpoints
@app.post("/api/ai/generate", response_model=Dict[str, Any])
async def generate_ai_text(request: Dict[str, str]):
    """
    Generate text using AI based on a prompt
    """
    prompt = request.get("prompt", "")
    logger.info(f"Received AI generation request with prompt: {prompt}")

    if not prompt:
        logger.warning("Empty prompt received")
        return {"success": False, "error": "Prompt is required"}

    try:
        result = await ai_service.generate_text(prompt)
        logger.info(f"AI generation result: {result.get('success')}")
        if result.get('success'):
            logger.info(
                f"Generated text length: {len(result.get('text', ''))}")
        else:
            logger.error(f"AI generation failed: {result.get('error')}")
        return result
    except Exception as e:
        logger.error(f"Error in generate_ai_text endpoint: {str(e)}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
