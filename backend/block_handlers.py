from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime

from .block_models import BlockDocument, Block, BlockType, BlockSessionLocal
from pydantic import BaseModel, Field

router = APIRouter()

# Pydantic models for request/response


class BlockBase(BaseModel):
    type: BlockType
    content: str
    position: int
    block_metadata: dict = Field(default_factory=dict)


class BlockCreate(BlockBase):
    pass


class BlockResponse(BlockBase):
    id: str
    document_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentCreate(BaseModel):
    title: str
    blocks: List[BlockCreate]


class DocumentResponse(BaseModel):
    id: str
    title: str
    blocks: List[BlockResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Dependency


def get_db():
    db = BlockSessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/block-documents/", response_model=DocumentResponse)
def create_document(document: DocumentCreate, db: Session = Depends(get_db)):
    db_document = BlockDocument(
        id=str(uuid.uuid4()),
        title=document.title
    )
    db.add(db_document)

    # Create blocks
    for block_data in document.blocks:
        db_block = Block(
            id=str(uuid.uuid4()),
            document_id=db_document.id,
            **block_data.dict()
        )
        db.add(db_block)

    db.commit()
    db.refresh(db_document)
    return db_document


@router.get("/block-documents/{document_id}", response_model=DocumentResponse)
def get_document(document_id: str, db: Session = Depends(get_db)):
    document = db.query(BlockDocument).filter(
        BlockDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.put("/block-documents/{document_id}/blocks/{block_id}", response_model=BlockResponse)
def update_block(
    document_id: str,
    block_id: str,
    block: BlockBase,
    db: Session = Depends(get_db)
):
    db_block = db.query(Block).filter(
        Block.id == block_id,
        Block.document_id == document_id
    ).first()
    if not db_block:
        raise HTTPException(status_code=404, detail="Block not found")

    for key, value in block.dict().items():
        setattr(db_block, key, value)

    db.commit()
    db.refresh(db_block)
    return db_block


@router.post("/block-documents/{document_id}/blocks/", response_model=BlockResponse)
def add_block(
    document_id: str,
    block: BlockCreate,
    db: Session = Depends(get_db)
):
    document = db.query(BlockDocument).filter(
        BlockDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    db_block = Block(
        id=str(uuid.uuid4()),
        document_id=document_id,
        **block.dict()
    )
    db.add(db_block)
    db.commit()
    db.refresh(db_block)
    return db_block


@router.delete("/block-documents/{document_id}/blocks/{block_id}")
def delete_block(
    document_id: str,
    block_id: str,
    db: Session = Depends(get_db)
):
    block = db.query(Block).filter(
        Block.id == block_id,
        Block.document_id == document_id
    ).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    db.delete(block)
    db.commit()
    return {"message": "Block deleted"}
