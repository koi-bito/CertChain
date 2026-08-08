"use client";
import { useState } from "react";
import Link from "next/link";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface IssueResult {
  credential_hash: string;
  tx_hash: string;
  certificate_text: string;
  verify_url: string;
}

export default function IssuePage() {
  const [form, setForm] = useState({
    holder_name: "",
    holder_email: "",
    issuer_name: "",
    course_title: "",
    duration_weeks: 4,
    skills_covered: "",
  });
  const [result, setResult] = useState<IssueResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await axios.post(`${API_BASE}/credentials/issue`, {
        ...form,
        duration_weeks: Number(form.duration_weeks),
        skills_covered: form.skills_covered
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setResult(res.data);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Something went wrong. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const skills = form.skills_covered
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

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
            <Link href="/" className="nav-link active">Issue</Link>
            <Link href="/verify" className="nav-link">Verify</Link>
          </div>
        </div>
      </nav>

      <main className="main">
        <div className="container">
          {/* Header */}
          <div className="page-header">
            <div className="badge">⚡ Ethereum Sepolia</div>
            <h1 className="page-title">Issue a Credential</h1>
            <p className="page-subtitle">
              Generate AI-written certificate text, anchor its hash on Ethereum,
              and get a permanent, tamper-proof verification link.
            </p>
          </div>

          {/* How it works */}
          <div className="steps">
            <div className="step">
              <span className="step-num">1</span>Fill the form
            </div>
            <div className="step">
              <span className="step-num">2</span>AI writes certificate
            </div>
            <div className="step">
              <span className="step-num">3</span>Hash anchored on-chain
            </div>
          </div>

          {/* Form */}
          <div className="card">
            <p className="section-label">Credential Details</p>

            {[
              ["Holder Name", "holder_name", "text", "e.g. Kunal Aggarwal"],
              ["Holder Email", "holder_email", "email", "e.g. kunal@example.com"],
              ["Issuing Organization", "issuer_name", "text", "e.g. VIT Bhopal University"],
              ["Course / Program Title", "course_title", "text", "e.g. Machine Learning Fundamentals"],
              ["Duration (weeks)", "duration_weeks", "number", "e.g. 8"],
              ["Skills Covered (comma-separated)", "skills_covered", "text", "e.g. PyTorch, scikit-learn, Neural Networks"],
            ].map(([label, key, type, placeholder]) => (
              <div className="form-group" key={key}>
                <label className="form-label">{label}</label>
                <input
                  id={key}
                  type={type}
                  className="form-input"
                  placeholder={placeholder}
                  value={(form as any)[key]}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                />
              </div>
            ))}

            {skills.length > 0 && (
              <div className="tag-list">
                {skills.map((s) => (
                  <span className="tag" key={s}>{s}</span>
                ))}
              </div>
            )}

            <div className="divider" />

            <button
              id="issue-btn"
              onClick={handleSubmit}
              disabled={loading}
              className="btn btn-primary btn-full"
            >
              {loading ? (
                <>
                  <div className="spinner" />
                  Issuing on blockchain… (~15s)
                </>
              ) : (
                "Issue Credential →"
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="error-text">⚠ {error}</p>
          )}

          {/* Success */}
          {result && (
            <div className="result-box success">
              <p className="result-title">✅ Credential Issued!</p>
              <div className="result-row">
                <div className="result-item">
                  <strong>Hash</strong>
                  <span className="mono">{result.credential_hash}</span>
                </div>
                <div className="result-item">
                  <strong>TX Hash</strong>
                  <span className="mono">{result.tx_hash}</span>
                </div>
                <div className="result-item">
                  <strong>Certificate</strong>
                  <span>{result.certificate_text}</span>
                </div>
              </div>
              <a
                href={`/verify?id=${result.credential_hash}`}
                className="result-link"
                id="verify-link"
              >
                → Verify this credential
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
