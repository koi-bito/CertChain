import requests

BASE = "http://localhost:8000/api"

print("🔗 CertChain Demo\n")
print("=" * 50)

# ── Issue a credential ────────────────────────────────
payload = {
    "holder_name": "Kunal Aggarwal",
    "holder_email": "kunal271202@gmail.com",
    "issuer_name": "VIT Bhopal University",
    "course_title": "Machine Learning Fundamentals",
    "duration_weeks": 8,
    "skills_covered": ["PyTorch", "scikit-learn", "Neural Networks", "Model Evaluation"]
}

print("📤 Issuing credential on Sepolia testnet...")
print(f"   Holder: {payload['holder_name']}")
print(f"   Course: {payload['course_title']}")
print(f"   Issuer: {payload['issuer_name']}")
print()

res = requests.post(f"{BASE}/credentials/issue", json=payload)

if res.status_code != 200:
    print(f"❌ Error: {res.json()}")
    exit(1)

data = res.json()

print("✅ Credential Issued!")
print(f"   Hash:        {data['credential_hash']}")
print(f"   TX Hash:     {data['tx_hash']}")
print(f"   Certificate: {data['certificate_text']}")
print(f"   Verify URL:  {data['verify_url']}")
print()

# ── Verify the credential ─────────────────────────────
print("=" * 50)
print("🔍 Verifying on-chain (free read call)...")
print()

verify_res = requests.get(f"{BASE}/verify/{data['credential_hash']}")
v = verify_res.json()

print(f"   Result:   {v['message']}")
print(f"   Holder:   {v.get('holder_name', 'N/A')}")
print(f"   Course:   {v.get('course_title', 'N/A')}")
print(f"   Issuer:   {v.get('issuer_name', 'N/A')}")
print(f"   On-chain issuer address: {v['issuer_address']}")
print(f"   Etherscan: {v['etherscan_url']}")
