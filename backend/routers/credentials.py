from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List

from database import get_db, CredentialRecord
from blockchain import generate_credential_hash, issue_on_chain
from ai_generator import generate_certificate_text

router = APIRouter(prefix="/credentials", tags=["credentials"])


class IssueRequest(BaseModel):
    holder_name: str
    holder_email: str
    issuer_name: str
    course_title: str
    duration_weeks: int
    skills_covered: List[str]


class IssueResponse(BaseModel):
    credential_hash: str
    tx_hash: str
    certificate_text: str
    verify_url: str


@router.post("/issue", response_model=IssueResponse)
async def issue_credential(req: IssueRequest, db: Session = Depends(get_db)):
    """
    Issues a new credential:
    1. Generates AI certificate text
    2. Computes SHA-256 hash of the credential content
    3. Anchors the hash on Ethereum Sepolia
    4. Saves metadata to PostgreSQL
    Returns credential_hash + tx_hash + verify URL.
    """
    issued_at = datetime.utcnow().isoformat()

    # Compute deterministic hash from core fields
    credential_hash = generate_credential_hash(
        req.holder_name, req.course_title, req.issuer_name, issued_at
    )

    # Check for duplicate
    existing = db.query(CredentialRecord).filter_by(credential_hash=credential_hash).first()
    if existing:
        raise HTTPException(status_code=409, detail="Credential already exists")

    # Generate certificate text with LLM
    cert_text = generate_certificate_text(
        req.holder_name, req.course_title, req.issuer_name,
        req.duration_weeks, req.skills_covered
    )

    # Metadata URI — use backend URL; swap for IPFS in production
    metadata_uri = f"https://certchain.app/api/credentials/{credential_hash}/metadata"

    # Write to blockchain (blocks ~15s on Sepolia)
    try:
        tx_hash = issue_on_chain(credential_hash, metadata_uri)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blockchain error: {str(e)}")

    # Persist to PostgreSQL
    record = CredentialRecord(
        credential_hash=credential_hash,
        holder_name=req.holder_name,
        holder_email=req.holder_email,
        issuer_name=req.issuer_name,
        course_title=req.course_title,
        credential_text=cert_text,
        tx_hash=tx_hash,
        issued_at=datetime.utcnow()
    )
    db.add(record)
    db.commit()

    return IssueResponse(
        credential_hash=credential_hash,
        tx_hash=tx_hash,
        certificate_text=cert_text,
        verify_url=f"https://certchain.app/verify?id={credential_hash}"
    )


@router.get("/{credential_hash}/metadata")
async def get_metadata(credential_hash: str, db: Session = Depends(get_db)):
    """Returns off-chain metadata for a credential (used as metadataURI by the contract)."""
    record = db.query(CredentialRecord).filter_by(credential_hash=credential_hash).first()
    if not record:
        raise HTTPException(status_code=404, detail="Credential not found")
    return {
        "credential_hash": record.credential_hash,
        "holder_name": record.holder_name,
        "issuer_name": record.issuer_name,
        "course_title": record.course_title,
        "certificate_text": record.credential_text,
        "issued_at": record.issued_at.isoformat(),
    }
