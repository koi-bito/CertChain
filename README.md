# CertChain - Blockchain Credential Verification

> Tamper-proof credential issuance and verification anchored on Ethereum Sepolia testnet.

[![CI](https://github.com/koi-bito/CertChain/actions/workflows/ci.yml/badge.svg)](https://github.com/koi-bito/CertChain/actions)

---

## What It Does

Fake internship letters and academic certificates are rampant. CertChain anchors a SHA-256 hash of every credential on the Ethereum blockchain. Verification becomes **trustless, instant, and permanent** - anyone can verify without calling the issuer.

**Who uses it:**
- **Issuers** (companies, colleges) - issue a credential, get a verification link
- **Holders** (students) - share the link on their resume
- **Verifiers** (recruiters) - paste the credential hash, get instant on-chain proof

---

## Architecture

```
[Issuer fills form]
        │
        ▼
[FastAPI Backend]
  - Generates certificate text via GPT-4o-mini
  - Hashes the content (SHA-256)
  - Calls CertChain.sol → stores hash on Sepolia
  - Saves metadata to PostgreSQL
  - Returns credential_id + tx_hash
        │
        ▼
[Ethereum Sepolia Testnet]
  CertChain.sol
  - issueCredential(bytes32 hash, string metadataURI)
  - verifyCredential(bytes32 hash) → bool + timestamp + issuer
  - revokeCredential(bytes32 hash)
        │
        ▼
[Verifier visits /verify?id=0xabc...]
  - Frontend calls backend
  - Backend queries contract (free read, no gas)
  - Returns: VALID ✅ / REVOKED ⚠️ / NOT FOUND ❌
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Smart Contract | Solidity 0.8.20 + Hardhat |
| Testnet | Sepolia (Ethereum testnet) |
| Backend | FastAPI + Web3.py + PostgreSQL |
| AI Layer | OpenAI GPT-4o-mini |
| Frontend | Next.js 14 |
| Infra | Docker + GitHub Actions CI |

---

## Project Structure

```
CertChain/
├── contracts/
│   └── CertChain.sol          # Smart contract
├── test/
│   └── CertChain.test.js      # Hardhat tests
├── scripts/
│   └── deploy.js              # Sepolia deployment script
├── backend/
│   ├── main.py                # FastAPI app
│   ├── blockchain.py          # Web3.py interface
│   ├── database.py            # SQLAlchemy models
│   ├── ai_generator.py        # OpenAI certificate generator
│   ├── CertChain_ABI.json     # Contract ABI
│   ├── routers/
│   │   ├── credentials.py     # POST /api/credentials/issue
│   │   └── verify.py          # GET /api/verify/{hash}
│   └── tests/
│       ├── conftest.py
│       └── test_api.py
├── frontend/
│   └── app/
│       ├── page.tsx           # Issue page
│       └── verify/page.tsx    # Verify page
├── .github/workflows/ci.yml   # GitHub Actions CI
├── docker-compose.yml
├── demo.py                    # End-to-end demo script
└── .env.example
```

---

## Quick Start

### 1. Prerequisites

- Node.js 20+
- Python 3.11+
- Docker Desktop
- MetaMask wallet with Sepolia ETH ([faucet](https://sepoliafaucet.com))

### 2. Environment Setup

```bash
cp .env.example .env
# Fill in your API keys in .env
```

### 3. Smart Contract

```bash
npm install
npx hardhat test              # Run all 6 tests
npx hardhat run scripts/deploy.js --network sepolia
# Copy the contract address into .env → CONTRACT_ADDRESS
npx hardhat verify --network sepolia YOUR_CONTRACT_ADDRESS
```

### 4. Backend

```bash
docker-compose up -d          # Starts PostgreSQL + FastAPI
# OR run locally:
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

API docs available at: http://localhost:8000/docs

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### 6. Run the Demo

```bash
python demo.py
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/credentials/issue` | Issue a new credential |
| `GET` | `/api/verify/{hash}` | Verify a credential on-chain |
| `GET` | `/api/credentials/{hash}/metadata` | Get off-chain metadata |
| `GET` | `/health` | Health check |

---

## Smart Contract (Sepolia)

Contract address: `0xCbF2ad856f7CDf2B6AeB42Cf3EB061c79e7ff5dd`

[View on Etherscan](https://sepolia.etherscan.io/address/0xCbF2ad856f7CDf2B6AeB42Cf3EB061c79e7ff5dd)

---

## License

MIT
