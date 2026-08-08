from sqlalchemy import create_engine, Column, String, DateTime, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://certchain_user:certchain_pass@localhost:5432/certchain")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class CredentialRecord(Base):
    __tablename__ = "credentials"

    credential_hash = Column(String(66), primary_key=True)  # 0x + 64 hex chars
    holder_name = Column(String(255), nullable=False)
    holder_email = Column(String(255), nullable=False)
    issuer_name = Column(String(255), nullable=False)
    course_title = Column(String(255), nullable=False)
    credential_text = Column(Text)           # AI-generated certificate content
    tx_hash = Column(String(66))             # Ethereum transaction hash
    issued_at = Column(DateTime, default=datetime.utcnow)
    revoked = Column(Boolean, default=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables. Call once at startup."""
    Base.metadata.create_all(bind=engine)
