"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface VerifyResult {
  valid: boolean;
  revoked: boolean;
  holder_name?: string;
  course_title?: string;
  issuer_name?: string;
  issued_at?: string;
  certificate_text?: string;
  issuer_address: string;
  etherscan_url: string;
  tx_hash?: string;
  message: string;
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const [hash, setHash] = useState(searchParams.get("id") || "");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const verify = async (h: string) => {
    if (!h) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await axios.get(`${API_BASE}/verify/${h}`);
      setResult(res.data);
    } catch (e: any) {
      if (e.response?.status === 400) {
        setError("Invalid hash format. Must be 0x followed by 64 hex characters.");
      } else {
        setResult({ valid: false, revoked: false, message: "❌ Error fetching from blockchain.", issuer_address: "", etherscan_url: "" });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hash) verify(hash);
  }, []);

  const boxClass = result
    ? result.valid
      ? "success"
      : result.revoked
      ? "warning"
      : "error"
    : "";

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "long" }) : "—";

  return (
    <div className="page-wrapper">
      {/* Nav */}
      <nav className="nav">
        <div className="nav-inner">
          <Link href="/" className="nav-logo">
            <div className="nav-logo-icon">⛓</div>
            CertChain
          </Link>
          <div className="nav-links">
            <Link href="/" className="nav-link">Issue</Link>
            <Link href="/verify" className="nav-link active">Verify</Link>
          </div>
        </div>
      </nav>

      <main className="main">
        <div className="container">
          {/* Header */}
          <div className="page-header">
            <div className="badge">🔍 Trustless Verification</div>
            <h1 className="page-title">Verify a Credential</h1>
            <p className="page-subtitle">
              Paste a credential hash below. We query Ethereum directly —
              no trust required, no login needed.
            </p>
          </div>

          {/* Search */}
          <div className="card">
            <p className="section-label">Credential Hash</p>
            <div className="form-group">
              <input
                id="hash-input"
                type="text"
                className="form-input mono"
                placeholder="0x..."
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verify(hash)}
              />
            </div>
            <button
              id="verify-btn"
              onClick={() => verify(hash)}
              disabled={loading || !hash}
              className="btn btn-primary btn-full"
            >
              {loading ? (
                <>
                  <div className="spinner" />
                  Querying blockchain…
                </>
              ) : (
                "Verify on Ethereum →"
              )}
            </button>
          </div>

          {/* Error */}
          {error && <p className="error-text">⚠ {error}</p>}

          {/* Result */}
          {result && (
            <div className={`result-box ${boxClass}`}>
              <p className="result-title">{result.message}</p>

              {result.holder_name && (
                <div className="result-row">
                  <div className="result-item">
                    <strong>Holder</strong>
                    <span>{result.holder_name}</span>
                  </div>
                  <div className="result-item">
                    <strong>Course</strong>
                    <span>{result.course_title}</span>
                  </div>
                  <div className="result-item">
                    <strong>Issuer</strong>
                    <span>{result.issuer_name}</span>
                  </div>
                  <div className="result-item">
                    <strong>Issued</strong>
                    <span>{formatDate(result.issued_at)}</span>
                  </div>
                  {result.certificate_text && (
                    <div className="result-item">
                      <strong>Certificate</strong>
                      <span style={{ fontStyle: "italic" }}>{result.certificate_text}</span>
                    </div>
                  )}
                  <div className="divider" />
                  <div className="result-item">
                    <strong>Issuer Addr</strong>
                    <span className="mono">{result.issuer_address}</span>
                  </div>
                  {result.tx_hash && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${result.tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="result-link"
                      id="etherscan-link"
                    >
                      → View transaction on Etherscan ↗
                    </a>
                  )}
                </div>
              )}

              {!result.holder_name && result.etherscan_url && (
                <a
                  href={result.etherscan_url}
                  target="_blank"
                  rel="noreferrer"
                  className="result-link"
                >
                  → View contract on Etherscan ↗
                </a>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  );
}
