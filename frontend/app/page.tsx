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

  const update = (key: string, val: string) =>
    setForm((p) => ({ ...p, [key]: val }));

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
      setError(
        e.response?.data?.detail || "Something went wrong. Is the backend running?"
      );
    } finally {
      setLoading(false);
    }
  };

  const skills = form.skills_covered
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

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
          <Link href="/" className="topbar-link active">
            Issue
          </Link>
          <Link href="/verify" className="topbar-link">
            Verify
          </Link>
        </div>
      </nav>

      {/* ── Two-column layout ──────────────────── */}
      <div className="layout">
        {/* Left — hero text */}
        <div className="layout-left">
          <div className="hero-tag">
            <span className="hero-tag-dot" />
            Ethereum Sepolia · Live
          </div>

          <h1 className="hero-title">
            Issue tamper-proof
            <br />
            <span className="highlight">credentials</span> on
            <br />
            the blockchain.
          </h1>

          <p className="hero-desc">
            Fill the form, our AI writes the certificate text, we hash it and
            anchor it permanently on Ethereum. Anyone can verify — no login, no
            trust required.
          </p>

          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-value">~15s</div>
              <div className="hero-stat-label">Issuance time</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">$0</div>
              <div className="hero-stat-label">Verification cost</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">∞</div>
              <div className="hero-stat-label">On-chain permanence</div>
            </div>
          </div>
        </div>

        {/* Right — form panel */}
        <div className="layout-right">
          <div className="panel">
            <div className="panel-header">
              New Credential <span className="panel-header-line" />
            </div>

            <div className="field">
              <label className="field-label">Holder Name</label>
              <input
                id="holder_name"
                className="field-input"
                placeholder="e.g. Kunal Aggarwal"
                value={form.holder_name}
                onChange={(e) => update("holder_name", e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label">Holder Email</label>
              <input
                id="holder_email"
                type="email"
                className="field-input"
                placeholder="e.g. kunal@example.com"
                value={form.holder_email}
                onChange={(e) => update("holder_email", e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label">Issuing Organization</label>
              <input
                id="issuer_name"
                className="field-input"
                placeholder="e.g. VIT Bhopal University"
                value={form.issuer_name}
                onChange={(e) => update("issuer_name", e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label">Course / Program</label>
              <input
                id="course_title"
                className="field-input"
                placeholder="e.g. Machine Learning Fundamentals"
                value={form.course_title}
                onChange={(e) => update("course_title", e.target.value)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
              <div className="field">
                <label className="field-label">Weeks</label>
                <input
                  id="duration_weeks"
                  type="number"
                  className="field-input"
                  placeholder="8"
                  value={form.duration_weeks}
                  onChange={(e) => update("duration_weeks", e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label">Skills (comma-separated)</label>
                <input
                  id="skills_covered"
                  className="field-input"
                  placeholder="PyTorch, scikit-learn, NNs"
                  value={form.skills_covered}
                  onChange={(e) => update("skills_covered", e.target.value)}
                />
              </div>
            </div>

            {skills.length > 0 && (
              <div className="tags">
                {skills.map((s) => (
                  <span className="tag" key={s}>
                    {s}
                  </span>
                ))}
              </div>
            )}

            <div className="divider" />

            <button
              id="issue-btn"
              onClick={handleSubmit}
              disabled={loading}
              className="btn btn-red btn-full"
            >
              {loading ? (
                <>
                  <div className="spinner" />
                  Writing to Sepolia… ~15s
                </>
              ) : (
                "Issue Credential →"
              )}
            </button>

            {error && <p className="error-text">⚠ {error}</p>}

            {result && (
              <div className="result ok">
                <p className="result-title">✅ Credential anchored on-chain</p>
                <div className="result-row">
                  <div className="result-item">
                    <strong>Hash</strong>
                    <span className="mono">{result.credential_hash}</span>
                  </div>
                  <div className="result-item">
                    <strong>TX</strong>
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
        </div>
      </div>
    </div>
  );
}
