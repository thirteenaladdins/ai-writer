from sqlalchemy import create_engine
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, JSON, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime
import enum

Base = declarative_base()


class BlockType(enum.Enum):
    PARAGRAPH = "paragraph"
    HEADING = "heading"
    LIST_ITEM = "list_item"
    CODE = "code"
    QUOTE = "quote"


class BlockDocument(Base):
    __tablename__ = "block_documents"

    id = Column(String, primary_key=True)
    title = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Relationship to blocks
    blocks = relationship(
        "Block", back_populates="document", order_by="Block.position")


class Block(Base):
    __tablename__ = "blocks"

    id = Column(String, primary_key=True)
    document_id = Column(String, ForeignKey("block_documents.id"))
    type = Column(Enum(BlockType))
    content = Column(String)
    position = Column(Integer)  # Order within the document
    # Flexible storage for formatting, attributes, etc
    block_metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Relationship to parent document
    document = relationship("BlockDocument", back_populates="blocks")


# Create SQLite database tables for block-based models
engine = create_engine("sqlite:///./ai_writer.db")
Base.metadata.create_all(engine)
BlockSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine)
