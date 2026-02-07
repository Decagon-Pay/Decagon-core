"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SpendPolicy {
  maxPerActionCents: number;
  dailyCapCents: number;
  autoApproveUnderCents: number;
  requireConfirmAboveCents: number;
  allowedOrigins: string[];
  allowedPaths: string[];
}

const API_BASE = "http://localhost:4000";

export default function SettingsPage() {
  const [policy, setPolicy] = useState<SpendPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [maxPerAction, setMaxPerAction] = useState("");
  const [dailyCap, setDailyCap] = useState("");
  const [autoApproveUnder, setAutoApproveUnder] = useState("");
  const [requireConfirmAbove, setRequireConfirmAbove] = useState("");
  const [allowedOrigins, setAllowedOrigins] = useState("");
  const [allowedPaths, setAllowedPaths] = useState("");

  useEffect(() => {
    fetchPolicy();
  }, []);

  const fetchPolicy = async () => {
    try {
      const res = await fetch(`${API_BASE}/policy`);
      if (res.ok) {
        const data = await res.json();
        setPolicy(data.policy);
        // Populate form
        setMaxPerAction((data.policy.maxPerActionCents / 100).toString());
        setDailyCap((data.policy.dailyCapCents / 100).toString());
        setAutoApproveUnder((data.policy.autoApproveUnderCents / 100).toString());
        setRequireConfirmAbove((data.policy.requireConfirmAboveCents / 100).toString());
        setAllowedOrigins(data.policy.allowedOrigins.join(", "));
        setAllowedPaths(data.policy.allowedPaths.join(", "));
      }
    } catch (e) {
      console.error("Failed to fetch policy:", e);
      setMessage({ type: "error", text: "Failed to load policy settings" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const newPolicy: Partial<SpendPolicy> = {
        maxPerActionCents: Math.round(parseFloat(maxPerAction) * 100),
        dailyCapCents: Math.round(parseFloat(dailyCap) * 100),
        autoApproveUnderCents: Math.round(parseFloat(autoApproveUnder) * 100),
        requireConfirmAboveCents: Math.round(parseFloat(requireConfirmAbove) * 100),
        allowedOrigins: allowedOrigins.split(",").map(s => s.trim()).filter(Boolean),
        allowedPaths: allowedPaths.split(",").map(s => s.trim()).filter(Boolean),
      };

      const res = await fetch(`${API_BASE}/policy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy: newPolicy }),
      });

      if (res.ok) {
        const data = await res.json();
        setPolicy(data.policy);
        setMessage({ type: "success", text: "Policy saved successfully!" });
      } else {
        const error = await res.json();
        setMessage({ type: "error", text: error.message ?? "Failed to save policy" });
      }
    } catch (e) {
      console.error("Failed to save policy:", e);
      setMessage({ type: "error", text: "Failed to save policy" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="container settings-page">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </main>
    );
  }

  return (
    <main className="container settings-page">
      <Link href="/" className="back-link">
        ← Back to Marketplace
      </Link>

      <div className="settings-header">
        <h1>⚙️ Spend Settings</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Configure your payment limits and allowlists
        </p>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="settings-card">
        <h2>Spend Limits</h2>
        
        <div className="form-group">
          <label>Max per action ($)</label>
          <input
            type="number"
            step="0.01"
            value={maxPerAction}
            onChange={(e) => setMaxPerAction(e.target.value)}
            placeholder="5.00"
          />
          <span className="help-text">Maximum amount allowed for a single payment</span>
        </div>

        <div className="form-group">
          <label>Daily cap ($)</label>
          <input
            type="number"
            step="0.01"
            value={dailyCap}
            onChange={(e) => setDailyCap(e.target.value)}
            placeholder="20.00"
          />
          <span className="help-text">Maximum total spend per day</span>
        </div>

        <div className="form-group">
          <label>Auto-approve under ($)</label>
          <input
            type="number"
            step="0.01"
            value={autoApproveUnder}
            onChange={(e) => setAutoApproveUnder(e.target.value)}
            placeholder="1.00"
          />
          <span className="help-text">Skip confirmation for amounts under this threshold</span>
        </div>

        <div className="form-group">
          <label>Require confirm above ($)</label>
          <input
            type="number"
            step="0.01"
            value={requireConfirmAbove}
            onChange={(e) => setRequireConfirmAbove(e.target.value)}
            placeholder="2.00"
          />
          <span className="help-text">Always require checkbox confirmation above this amount</span>
        </div>
      </div>

      <div className="settings-card">
        <h2>Allowlists</h2>

        <div className="form-group">
          <label>Allowed origins</label>
          <input
            type="text"
            value={allowedOrigins}
            onChange={(e) => setAllowedOrigins(e.target.value)}
            placeholder="*, http://localhost:3000"
          />
          <span className="help-text">Comma-separated list of allowed origins (* = all)</span>
        </div>

        <div className="form-group">
          <label>Allowed paths</label>
          <input
            type="text"
            value={allowedPaths}
            onChange={(e) => setAllowedPaths(e.target.value)}
            placeholder="/article/*, /api/*"
          />
          <span className="help-text">Comma-separated list of allowed paths (* = wildcard)</span>
        </div>
      </div>

      <div className="settings-actions">
        <button 
          className="btn btn-primary" 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {policy && (
        <div className="settings-card" style={{ marginTop: "2rem" }}>
          <h2>Current Policy (raw)</h2>
          <pre style={{ 
            background: "var(--bg-secondary)", 
            padding: "1rem", 
            borderRadius: "8px",
            fontSize: "0.75rem",
            overflow: "auto"
          }}>
            {JSON.stringify(policy, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: "2rem" }}>
        <Link href="/agents" className="btn btn-secondary">
          Manage Agents →
        </Link>
      </div>

      <style jsx>{`
        .settings-page {
          max-width: 600px;
          margin: 0 auto;
          padding: 2rem;
        }

        .settings-header {
          margin-bottom: 2rem;
        }

        .settings-header h1 {
          margin-bottom: 0.5rem;
        }

        .message {
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
        }

        .message.success {
          background: rgba(34, 197, 94, 0.1);
          color: var(--success);
          border: 1px solid var(--success);
        }

        .message.error {
          background: rgba(239, 68, 68, 0.1);
          color: var(--error);
          border: 1px solid var(--error);
        }

        .settings-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .settings-card h2 {
          font-size: 1.125rem;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border);
        }

        .form-group {
          margin-bottom: 1.25rem;
        }

        .form-group label {
          display: block;
          font-weight: 500;
          margin-bottom: 0.5rem;
        }

        .form-group input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg-secondary);
          color: var(--text);
          font-size: 1rem;
        }

        .form-group input:focus {
          outline: none;
          border-color: var(--primary);
        }

        .help-text {
          display: block;
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 0.25rem;
        }

        .settings-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
        }
      `}</style>
    </main>
  );
}
