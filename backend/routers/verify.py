from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db, CredentialRecord
from blockchain import verify_on_chain

router = APIRouter(prefix="/verify", tags=["verify"])


class VerifyResponse(BaseModel):
    valid: bool
    revoked: bool
    holder_name: Optional[str]
    course_title: Optional[str]
    issuer_name: Optional[str]
    issued_at: Optional[str]
    certificate_text: Optional[str]
    issuer_address: str
    etherscan_url: str
    tx_hash: Optional[str]
    message: str


@router.get("/{credential_hash}", response_model=VerifyResponse)
async def verify_credential(credential_hash: str, db: Session = Depends(get_db)):
    """
    Verifies a credential:
    1. Validates hash format
    2. Queries Ethereum (source of truth, free read call)
    3. Enriches with PostgreSQL metadata if available
    Returns full verification result including holder info + Etherscan link.
    """
    if not credential_hash.startswith("0x") or len(credential_hash) != 66:
        raise HTTPException(status_code=400, detail="Invalid credential hash format. Expected 0x + 64 hex chars.")

    # Blockchain is the source of truth - no gas required for reads
    chain_result = verify_on_chain(credential_hash)

    if not chain_result["valid"]:
        return VerifyResponse(
            valid=False,
            revoked=False,
            holder_name=None,
            course_title=None,
            issuer_name=None,
            issued_at=None,
            certificate_text=None,
            issuer_address="0x0000000000000000000000000000000000000000",
            etherscan_url=chain_result["etherscan_url"],
            tx_hash=None,
            message="❌ Credential not found on blockchain. Not issued or invalid."
        )

    # Fetch off-chain metadata from PostgreSQL
    record = db.query(CredentialRecord).filter_by(credential_hash=credential_hash).first()

    if chain_result["revoked"]:
        message = "⚠️ Credential was issued but has been REVOKED by the issuer."
    else:
        message = "✅ Credential is valid and verified on Ethereum Sepolia."

    return VerifyResponse(
        valid=chain_result["valid"] and not chain_result["revoked"],
        revoked=chain_result["revoked"],
        holder_name=record.holder_name if record else None,
        course_title=record.course_title if record else None,
        issuer_name=record.issuer_name if record else None,
        issued_at=record.issued_at.isoformat() if record else None,
        certificate_text=record.credential_text if record else None,
        issuer_address=chain_result["issuer_address"],
        etherscan_url=chain_result["etherscan_url"],
        tx_hash=record.tx_hash if record else None,
        message=message
    )
