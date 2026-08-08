import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import sys
import os

# Allow imports from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@patch("routers.credentials.generate_certificate_text", return_value="This certifies completion.")
@patch("routers.credentials.issue_on_chain", return_value="0x" + "a" * 64)
@patch("routers.credentials.generate_credential_hash", return_value="0x" + "b" * 64)
def test_issue_credential(mock_hash, mock_chain, mock_ai, db_session):
    payload = {
        "holder_name": "Kunal Aggarwal",
        "holder_email": "kunal@example.com",
        "issuer_name": "VIT Bhopal",
        "course_title": "Machine Learning",
        "duration_weeks": 8,
        "skills_covered": ["PyTorch", "scikit-learn"]
    }
    response = client.post("/api/credentials/issue", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "credential_hash" in data
    assert "tx_hash" in data


@patch("routers.verify.verify_on_chain", return_value={
    "valid": False, "revoked": False, "issuer_address": "0x" + "0" * 40,
    "timestamp": 0, "metadata_uri": "", "etherscan_url": "https://sepolia.etherscan.io"
})
def test_verify_invalid_credential(mock_chain):
    response = client.get("/api/verify/0x" + "c" * 64)
    assert response.status_code == 200
    assert response.json()["valid"] is False


def test_verify_bad_hash_format():
    response = client.get("/api/verify/not-a-valid-hash")
    assert response.status_code == 400
