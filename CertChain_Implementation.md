# CertChain — Tamper-Proof Credential Verification on Ethereum
### Full Implementation Guide · Kunal Aggarwal

---

## The Problem

Fake internship letters, certificates, and academic credentials are rampant — especially in India's job market. Recruiters can't verify without calling the issuer. Issuers have no audit trail. The solution: anchor a credential's hash on-chain. Verification becomes trustless, instant, and permanent.

**Who uses this:**
- **Issuers** (companies, colleges) — mint a credential NFT or store a hash on-chain
- **Holders** (students) — share a verification link
- **Verifiers** (recruiters) — paste the credential ID, get instant on-chain proof

This is a genuinely useful tool. Small scope, real impact.

---

## Tech Stack

| Layer | Tech | Why |
|---|---|---|
| Smart Contract | Solidity 0.8.x + Hardhat | Industry standard, huge ecosystem |
| Testnet | Sepolia (Ethereum testnet) | Free ETH via faucet, no real money |
| Backend | FastAPI + Web3.py | Your existing strength |
| Database | PostgreSQL | Store metadata off-chain (name, issuer, etc.) |
| Frontend | Next.js (minimal) | Two pages only: issue + verify |
| Infra | Docker + GitHub Actions | Already on your resume |
| AI Layer | OpenAI API / local LLM | Auto-generate certificate text from structured input |

---

## Architecture Overview

```
[Issuer fills form]
        │
        ▼
[FastAPI Backend]
  - Generates certificate text via LLM
  - Hashes the content (SHA-256)
  - Calls smart contract → stores hash on Sepolia
  - Saves metadata to PostgreSQL
  - Returns credential_id + tx_hash
        │
        ▼
[Ethereum Sepolia Testnet]
  CertChain.sol
  - mapping(bytes32 => Credential) public credentials
  - issueCredential(bytes32 hash, string metadata_uri)
  - verifyCredential(bytes32 hash) → bool + timestamp + issuer
        │
        ▼
[Verifier visits /verify?id=0xabc...]
  - Frontend calls backend
  - Backend calls contract read (free, no gas)
  - Returns: VALID ✅ / NOT FOUND ❌ + issuer + timestamp
```

---

## Week-by-Week Plan (3 Weeks)

### WEEK 1 — Smart Contract + Hardhat Setup (Days 1–7)

**Day 1–2: Environment Setup**

```bash
# Install Node.js 20+ first
node --version

mkdir certchain && cd certchain
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npx hardhat init
# Choose: "Create a JavaScript project"

# Install Web3 Python side
pip install web3 fastapi uvicorn python-dotenv psycopg2-binary openai pydantic
```

Create `.env`:
```
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
PRIVATE_KEY=your_metamask_wallet_private_key_for_sepolia_only
ETHERSCAN_API_KEY=your_etherscan_key
OPENAI_API_KEY=your_key
DATABASE_URL=postgresql://user:pass@localhost:5432/certchain
```

**Get free Sepolia ETH:**
- Go to https://sepoliafaucet.com
- Connect MetaMask (set to Sepolia network)
- Request 0.5 ETH — takes 2 minutes

---

**Day 3–4: Write the Smart Contract**

File: `contracts/CertChain.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CertChain {

    struct Credential {
        address issuer;
        uint256 timestamp;
        string metadataURI;   // IPFS or backend URL with name, course, etc.
        bool exists;
        bool revoked;
    }

    // hash -> Credential
    mapping(bytes32 => Credential) public credentials;

    // issuer address -> list of hashes they issued
    mapping(address => bytes32[]) public issuerCredentials;

    event CredentialIssued(
        bytes32 indexed credentialHash,
        address indexed issuer,
        uint256 timestamp,
        string metadataURI
    );

    event CredentialRevoked(
        bytes32 indexed credentialHash,
        address indexed issuer
    );

    // Issue a new credential
    function issueCredential(
        bytes32 credentialHash,
        string calldata metadataURI
    ) external {
        require(!credentials[credentialHash].exists, "Credential already exists");

        credentials[credentialHash] = Credential({
            issuer: msg.sender,
            timestamp: block.timestamp,
            metadataURI: metadataURI,
            exists: true,
            revoked: false
        });

        issuerCredentials[msg.sender].push(credentialHash);

        emit CredentialIssued(credentialHash, msg.sender, block.timestamp, metadataURI);
    }

    // Verify — returns all info, free (read-only)
    function verifyCredential(bytes32 credentialHash)
        external
        view
        returns (
            bool valid,
            bool revoked,
            address issuer,
            uint256 timestamp,
            string memory metadataURI
        )
    {
        Credential memory cred = credentials[credentialHash];
        return (
            cred.exists,
            cred.revoked,
            cred.issuer,
            cred.timestamp,
            cred.metadataURI
        );
    }

    // Revoke — only original issuer can revoke
    function revokeCredential(bytes32 credentialHash) external {
        require(credentials[credentialHash].exists, "Credential does not exist");
        require(credentials[credentialHash].issuer == msg.sender, "Not the issuer");
        require(!credentials[credentialHash].revoked, "Already revoked");

        credentials[credentialHash].revoked = true;
        emit CredentialRevoked(credentialHash, msg.sender);
    }

    // Get all credentials issued by an address
    function getIssuerCredentials(address issuer)
        external
        view
        returns (bytes32[] memory)
    {
        return issuerCredentials[issuer];
    }
}
```

---

**Day 5: Write Hardhat Tests**

File: `test/CertChain.test.js`

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CertChain", function () {
  let certChain, owner, addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    const CertChain = await ethers.getContractFactory("CertChain");
    certChain = await CertChain.deploy();
    await certChain.waitForDeployment();
  });

  it("should issue a credential", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("test-credential-kunal"));
    await certChain.issueCredential(hash, "https://certchain.app/meta/1");

    const [valid, revoked, issuer, timestamp, uri] =
      await certChain.verifyCredential(hash);

    expect(valid).to.equal(true);
    expect(revoked).to.equal(false);
    expect(issuer).to.equal(owner.address);
    expect(uri).to.equal("https://certchain.app/meta/1");
  });

  it("should not allow duplicate credentials", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("duplicate-test"));
    await certChain.issueCredential(hash, "uri1");
    await expect(
      certChain.issueCredential(hash, "uri2")
    ).to.be.revertedWith("Credential already exists");
  });

  it("should allow issuer to revoke", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("revoke-test"));
    await certChain.issueCredential(hash, "uri");
    await certChain.revokeCredential(hash);

    const [, revoked] = await certChain.verifyCredential(hash);
    expect(revoked).to.equal(true);
  });

  it("should not allow non-issuer to revoke", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("non-issuer-test"));
    await certChain.issueCredential(hash, "uri");
    await expect(
      certChain.connect(addr1).revokeCredential(hash)
    ).to.be.revertedWith("Not the issuer");
  });
});
```

Run tests:
```bash
npx hardhat test
# All 4 should pass
```

---

**Day 6–7: Deploy to Sepolia**

File: `hardhat.config.js` (replace the default):
```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
```

File: `scripts/deploy.js`:
```javascript
const { ethers } = require("hardhat");

async function main() {
  const CertChain = await ethers.getContractFactory("CertChain");
  console.log("Deploying CertChain...");
  const certChain = await CertChain.deploy();
  await certChain.waitForDeployment();

  const address = await certChain.getAddress();
  console.log(`CertChain deployed to: ${address}`);
  console.log(`Verify on Etherscan: https://sepolia.etherscan.io/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Deploy:
```bash
npx hardhat run scripts/deploy.js --network sepolia
# Copy the contract address — you'll need it in .env

npx hardhat verify --network sepolia YOUR_CONTRACT_ADDRESS
# Makes contract code visible on Etherscan (big credibility signal)
```

Add to `.env`:
```
CONTRACT_ADDRESS=0xYourDeployedAddress
```

---

### WEEK 2 — FastAPI Backend (Days 8–14)

**Project structure:**
```
backend/
├── main.py
├── models.py
├── database.py
├── blockchain.py
├── ai_generator.py
├── routers/
│   ├── credentials.py
│   └── verify.py
├── requirements.txt
└── Dockerfile
```

---

**Day 8: Database Models**

File: `backend/database.py`
```python
from sqlalchemy import create_engine, Column, String, DateTime, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class CredentialRecord(Base):
    __tablename__ = "credentials"

    credential_hash = Column(String(66), primary_key=True)  # 0x + 64 hex
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

# Run once to create tables
Base.metadata.create_all(bind=engine)
```

---

**Day 9–10: Blockchain Interface**

File: `backend/blockchain.py`
```python
from web3 import Web3
from eth_account import Account
import json
import os
import hashlib

# Load ABI — copy from artifacts/contracts/CertChain.sol/CertChain.json after hardhat compile
with open("CertChain_ABI.json") as f:
    CONTRACT_ABI = json.load(f)

w3 = Web3(Web3.HTTPProvider(os.getenv("SEPOLIA_RPC_URL")))
account = Account.from_key(os.getenv("PRIVATE_KEY"))
contract = w3.eth.contract(
    address=os.getenv("CONTRACT_ADDRESS"),
    abi=CONTRACT_ABI
)

def generate_credential_hash(holder_name: str, course_title: str, issuer_name: str, issued_at: str) -> str:
    """Deterministic hash from credential content."""
    content = f"{holder_name}::{course_title}::{issuer_name}::{issued_at}"
    return "0x" + hashlib.sha256(content.encode()).hexdigest()

def issue_on_chain(credential_hash: str, metadata_uri: str) -> str:
    """
    Sends a transaction to issue the credential on Sepolia.
    Returns the transaction hash.
    """
    hash_bytes = bytes.fromhex(credential_hash[2:])  # strip 0x

    nonce = w3.eth.get_transaction_count(account.address)
    gas_price = w3.eth.gas_price

    txn = contract.functions.issueCredential(
        hash_bytes,
        metadata_uri
    ).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "gas": 200000,
        "gasPrice": gas_price,
    })

    signed = account.sign_transaction(txn)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    if receipt.status != 1:
        raise Exception("Transaction failed on-chain")

    return tx_hash.hex()

def verify_on_chain(credential_hash: str) -> dict:
    """
    Pure read call — no gas, instant.
    Returns verification result from the blockchain.
    """
    hash_bytes = bytes.fromhex(credential_hash[2:])

    valid, revoked, issuer, timestamp, metadata_uri = contract.functions.verifyCredential(
        hash_bytes
    ).call()

    return {
        "valid": valid,
        "revoked": revoked,
        "issuer_address": issuer,
        "timestamp": timestamp,
        "metadata_uri": metadata_uri,
        "etherscan_url": f"https://sepolia.etherscan.io/address/{os.getenv('CONTRACT_ADDRESS')}"
    }

def revoke_on_chain(credential_hash: str) -> str:
    """Revoke a credential on-chain. Only works if caller is original issuer."""
    hash_bytes = bytes.fromhex(credential_hash[2:])
    nonce = w3.eth.get_transaction_count(account.address)

    txn = contract.functions.revokeCredential(hash_bytes).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "gas": 100000,
        "gasPrice": w3.eth.gas_price,
    })

    signed = account.sign_transaction(txn)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    w3.eth.wait_for_transaction_receipt(tx_hash)
    return tx_hash.hex()
```

---

**Day 11: AI Certificate Generator**

File: `backend/ai_generator.py`
```python
from openai import OpenAI
import os

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def generate_certificate_text(
    holder_name: str,
    course_title: str,
    issuer_name: str,
    duration_weeks: int,
    skills_covered: list[str]
) -> str:
    """
    Uses LLM to generate professional certificate body text.
    The hash of this text is what gets anchored on-chain.
    """
    prompt = f"""
    Generate a formal certificate of completion text for the following:
    
    Recipient: {holder_name}
    Course/Program: {course_title}
    Issuing Organization: {issuer_name}
    Duration: {duration_weeks} weeks
    Skills Covered: {', '.join(skills_covered)}
    
    Write only the certificate body text (2-3 sentences). 
    Professional, formal tone. No placeholders. No extra commentary.
    Include specific skills mentioned.
    """

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
        temperature=0.3
    )

    return response.choices[0].message.content.strip()
```

---

**Day 12–13: API Routes**

File: `backend/routers/credentials.py`
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
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
    issued_at = datetime.utcnow().isoformat()

    # Check for duplicate
    credential_hash = generate_credential_hash(
        req.holder_name, req.course_title, req.issuer_name, issued_at
    )
    existing = db.query(CredentialRecord).filter_by(credential_hash=credential_hash).first()
    if existing:
        raise HTTPException(status_code=409, detail="Credential already exists")

    # Generate certificate text with AI
    cert_text = generate_certificate_text(
        req.holder_name, req.course_title, req.issuer_name,
        req.duration_weeks, req.skills_covered
    )

    # Store metadata URI — in production, use IPFS. For now, use backend URL
    metadata_uri = f"https://certchain.app/api/credentials/{credential_hash}/metadata"

    # Write to blockchain (takes ~15 seconds on Sepolia)
    try:
        tx_hash = issue_on_chain(credential_hash, metadata_uri)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blockchain error: {str(e)}")

    # Save to PostgreSQL
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
```

File: `backend/routers/verify.py`
```python
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
    if not credential_hash.startswith("0x") or len(credential_hash) != 66:
        raise HTTPException(status_code=400, detail="Invalid credential hash format")

    # Check blockchain first — source of truth
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

    # Fetch metadata from PostgreSQL
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
```

File: `backend/main.py`
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import credentials, verify

app = FastAPI(
    title="CertChain API",
    description="Blockchain-anchored credential verification",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(credentials.router, prefix="/api")
app.include_router(verify.router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok", "service": "CertChain API"}
```

---

**Day 14: Dockerfile + docker-compose**

File: `backend/Dockerfile`
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

File: `docker-compose.yml` (root of project):
```yaml
version: "3.9"
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: certchain
      POSTGRES_USER: certchain_user
      POSTGRES_PASSWORD: certchain_pass
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://certchain_user:certchain_pass@db:5432/certchain
      SEPOLIA_RPC_URL: ${SEPOLIA_RPC_URL}
      PRIVATE_KEY: ${PRIVATE_KEY}
      CONTRACT_ADDRESS: ${CONTRACT_ADDRESS}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      - db

volumes:
  pgdata:
```

---

### WEEK 3 — Frontend + CI/CD + Polish (Days 15–21)

**Day 15–17: Next.js Frontend (2 pages only)**

```bash
npx create-next-app@latest frontend --typescript --tailwind --app
cd frontend
npm install axios
```

File: `frontend/app/page.tsx` — Issue Page
```tsx
"use client";
import { useState } from "react";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export default function IssuePage() {
  const [form, setForm] = useState({
    holder_name: "", holder_email: "", issuer_name: "",
    course_title: "", duration_weeks: 4, skills_covered: ""
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API_BASE}/credentials/issue`, {
        ...form,
        skills_covered: form.skills_covered.split(",").map(s => s.trim())
      });
      setResult(res.data);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">CertChain</h1>
      <p className="text-gray-500 mb-8">Issue tamper-proof credentials on Ethereum</p>

      <div className="space-y-4">
        {[
          ["Holder Name", "holder_name", "text"],
          ["Holder Email", "holder_email", "email"],
          ["Issuer Organization", "issuer_name", "text"],
          ["Course / Program Title", "course_title", "text"],
          ["Duration (weeks)", "duration_weeks", "number"],
          ["Skills Covered (comma-separated)", "skills_covered", "text"],
        ].map(([label, key, type]) => (
          <div key={key as string}>
            <label className="block text-sm font-medium mb-1">{label as string}</label>
            <input
              type={type as string}
              className="w-full border rounded px-3 py-2 text-sm"
              value={(form as any)[key as string]}
              onChange={e => setForm(prev => ({ ...prev, [key as string]: e.target.value }))}
            />
          </div>
        ))}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Issuing on blockchain... (~15s)" : "Issue Credential"}
        </button>
      </div>

      {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}

      {result && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded">
          <p className="font-semibold text-green-800 mb-2">✅ Credential Issued!</p>
          <p className="text-xs text-gray-600 mb-1"><strong>Hash:</strong> {result.credential_hash}</p>
          <p className="text-xs text-gray-600 mb-1"><strong>TX:</strong> {result.tx_hash}</p>
          <p className="text-xs text-gray-600 mb-3"><strong>Certificate:</strong> {result.certificate_text}</p>
          <a
            href={`/verify?id=${result.credential_hash}`}
            className="text-blue-600 text-sm underline"
          >
            → Verify this credential
          </a>
        </div>
      )}
    </main>
  );
}
```

File: `frontend/app/verify/page.tsx` — Verify Page
```tsx
"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const [hash, setHash] = useState(searchParams.get("id") || "");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const verify = async (h: string) => {
    if (!h) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/verify/${h}`);
      setResult(res.data);
    } catch {
      setResult({ valid: false, message: "❌ Error fetching from blockchain." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hash) verify(hash);
  }, []);

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">Verify Credential</h1>
      <p className="text-gray-500 mb-6">Enter a credential hash to verify authenticity on Ethereum</p>

      <div className="flex gap-2 mb-6">
        <input
          className="flex-1 border rounded px-3 py-2 text-sm font-mono"
          placeholder="0x..."
          value={hash}
          onChange={e => setHash(e.target.value)}
        />
        <button
          onClick={() => verify(hash)}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
        >
          {loading ? "Checking..." : "Verify"}
        </button>
      </div>

      {result && (
        <div className={`p-4 rounded border ${result.valid ? "bg-green-50 border-green-200" : result.revoked ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"}`}>
          <p className="font-semibold mb-3">{result.message}</p>
          {result.holder_name && (
            <div className="space-y-1 text-sm text-gray-700">
              <p><strong>Holder:</strong> {result.holder_name}</p>
              <p><strong>Course:</strong> {result.course_title}</p>
              <p><strong>Issuer:</strong> {result.issuer_name}</p>
              <p><strong>Issued:</strong> {result.issued_at}</p>
              <p><strong>Issuer Address:</strong> <span className="font-mono text-xs">{result.issuer_address}</span></p>
              {result.tx_hash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${result.tx_hash}`}
                  target="_blank"
                  className="text-blue-600 underline block mt-2"
                >
                  → View transaction on Etherscan
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
```

---

**Day 18–19: GitHub Actions CI/CD**

File: `.github/workflows/ci.yml`
```yaml
name: CertChain CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "20"
      - run: npm install
      - run: npx hardhat test

  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: "3.11"
      - run: pip install -r backend/requirements.txt
      - run: cd backend && python -m pytest tests/ -v
        env:
          DATABASE_URL: "sqlite:///test.db"
          SEPOLIA_RPC_URL: "mock"
          PRIVATE_KEY: "0x0000000000000000000000000000000000000000000000000000000000000001"
          CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000000"
          OPENAI_API_KEY: "mock"
```

---

**Day 20: README + Demo Script**

Write a demo script that:
1. Issues a test credential
2. Prints the hash and Etherscan link
3. Verifies it

File: `demo.py`
```python
import requests

BASE = "http://localhost:8000/api"

print("🔗 CertChain Demo\n")

# Issue
payload = {
    "holder_name": "Kunal Aggarwal",
    "holder_email": "kunal271202@gmail.com",
    "issuer_name": "VIT Bhopal University",
    "course_title": "Machine Learning Fundamentals",
    "duration_weeks": 8,
    "skills_covered": ["PyTorch", "scikit-learn", "Neural Networks", "Model Evaluation"]
}

print("Issuing credential on Sepolia testnet...")
res = requests.post(f"{BASE}/credentials/issue", json=payload)
data = res.json()

print(f"\n✅ Issued!")
print(f"Hash: {data['credential_hash']}")
print(f"TX: {data['tx_hash']}")
print(f"Certificate: {data['certificate_text']}")
print(f"\nVerify at: {data['verify_url']}")

# Verify
print("\n\nVerifying on-chain...")
verify_res = requests.get(f"{BASE}/verify/{data['credential_hash']}")
v = verify_res.json()
print(f"Result: {v['message']}")
print(f"Issuer address: {v['issuer_address']}")
```

---

**Day 21: Final polish**

- Add a `LIVE_DEMO.md` with screenshots of Etherscan showing your deployed contract
- Record a 60-second Loom/screen recording of issuing + verifying a credential
- Push everything to GitHub with a clean README

---

## What Goes on Your Resume

```
CertChain — Blockchain Credential Verification System
github.com/koi-bito/certchain

- Built and deployed a Solidity smart contract (CertChain.sol) on Ethereum Sepolia testnet for tamper-proof 
  credential issuance and verification; integrated Web3.py with a FastAPI backend to bridge on-chain state 
  with off-chain metadata (PostgreSQL).
  
- Used LLM (GPT-4o-mini via OpenAI API) to auto-generate certificate text from structured input; anchored 
  SHA-256 content hashes on-chain so certificates are verifiable without trusting any central authority.
  
- Shipped full-stack: Next.js verifier UI, Dockerised services, GitHub Actions CI running Hardhat contract 
  tests and Python backend tests on every push; contract verified on Etherscan.
```

---

## Key Interview Questions You'll Be Able to Answer

**"Tell me about your blockchain experience"**
> "I built CertChain, a credential verification system on Ethereum. I wrote a Solidity contract that stores SHA-256 hashes of credentials on Sepolia testnet. The contract has issue, verify, and revoke functions. On the backend I used Web3.py to send signed transactions from Python, and a FastAPI service bridges the on-chain state with off-chain metadata in PostgreSQL. I combined it with an LLM that generates the certificate text, so the whole flow is AI-assisted + blockchain-anchored."

**"Why blockchain for this?"**
> "Trustlessness. A PDF certificate can be faked. A database record can be edited. A hash on a public blockchain cannot — anyone can verify it without trusting me or the issuer."

**"What's a gas limit and did you set one?"**
> "Gas is the unit of computational work on Ethereum. Each operation costs gas, and you set a maximum to prevent runaway costs. I set 200,000 gas for issueCredential, which is well above the actual cost of ~50,000–80,000 gas for a mapping write."

**"What's the difference between a view function and a state-changing function?"**
> "View functions are read-only — they don't modify state, cost no gas, and return instantly. verifyCredential is a view function. issueCredential and revokeCredential modify state, so they require a signed transaction and gas."

---

## Total Effort Estimate

| Week | Focus | Hours/day |
|---|---|---|
| Week 1 | Solidity + Hardhat + deploy | 2–3 hrs |
| Week 2 | FastAPI + Web3.py + Docker | 2–3 hrs |
| Week 3 | Frontend + CI/CD + README | 1–2 hrs |

**Realistically: 35–45 hours total across 3 weeks.**
