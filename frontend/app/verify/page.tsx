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
        setError(
          "Invalid hash format. Must be 0x followed by 64 hex characters."
        );
      } else {
        setResult({
          valid: false,
          revoked: false,
          message: "❌ Error reaching blockchain.",
          issuer_address: "",
          etherscan_url: "",
        });
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
      ? "ok"
      : result.revoked
      ? "warn"
      : "fail"
    : "";

  const formatDate = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "long" })
      : "—";

  return (
    <div className="scene">
      <div className="scene-accent" />

      {/* ── Topbar ─────────────────────────────── */}
      <nav className="topbar">
        <Link href="/" className="topbar-brand">
          <div className="topbar-mark">⛓</div>
          <span className="topbar-name">
            Cert<span>Chain</span>
          </span>
        </Link>
        <div className="topbar-nav">
          <Link href="/" className="topbar-link">
            Issue
          </Link>
          <Link href="/verify" className="topbar-link active">
            Verify
          </Link>
        </div>
      </nav>

      {/* ── Centered layout ────────────────────── */}
      <div className="layout-center">
        <div className="center-content">
          <div className="hero-tag" style={{ marginBottom: 20 }}>
            <span className="hero-tag-dot" />
            Trustless Verification
          </div>

          <h1 className="hero-title" style={{ marginBottom: 12 }}>
            Verify a <span className="highlight">credential</span>
          </h1>

          <p
            className="hero-desc"
            style={{ marginBottom: 32, maxWidth: "none" }}
          >
            Paste a credential hash. We query Ethereum directly — no trust, no
            login, no middlemen.
          </p>

          <div className="panel">
            <div className="panel-header">
              Credential Hash <span className="panel-header-line" />
            </div>

            <div className="field">
              <input
                id="hash-input"
                type="text"
                className="field-input mono"
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
              className="btn btn-red btn-full"
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

            {error && <p className="error-text">⚠ {error}</p>}

            {result && (
              <div className={`result ${boxClass}`}>
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
                        <span style={{ fontStyle: "italic", opacity: 0.85 }}>
                          {result.certificate_text}
                        </span>
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
        </div>
      </div>
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
