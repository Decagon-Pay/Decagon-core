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

interface Agent {
  agentId: string;
  name: string;
  policy: SpendPolicy;
  createdAt: string;
  lastUsedAt?: string;
  tokenPreview: string;
  agentToken?: string; // Only present on creation
}

interface CreateAgentResponse {
  ok: boolean;
  agentId: string;
  agentToken: string;
  name: string;
  policy: SpendPolicy;
  curl: string;
}

const API_BASE = "http://localhost:4000";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAgentResult, setNewAgentResult] = useState<CreateAgentResponse | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [agentName, setAgentName] = useState("My Agent");
  const [maxPerAction, setMaxPerAction] = useState("1.00");
  const [dailyCap, setDailyCap] = useState("5.00");
  const [allowedPaths, setAllowedPaths] = useState("/article/*");

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_BASE}/agent/list`);
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents);
      }
    } catch (e) {
      console.error("Failed to fetch agents:", e);
      setMessage({ type: "error", text: "Failed to load agents" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setMessage(null);
    setNewAgentResult(null);

    try {
      const policy: Partial<SpendPolicy> = {
        maxPerActionCents: Math.round(parseFloat(maxPerAction) * 100),
        dailyCapCents: Math.round(parseFloat(dailyCap) * 100),
        autoApproveUnderCents: 50, // $0.50 auto-approve for agents
        requireConfirmAboveCents: 100, // $1.00 confirm for agents
        allowedOrigins: ["*"],
        allowedPaths: allowedPaths.split(",").map(s => s.trim()).filter(Boolean),
      };

      const res = await fetch(`${API_BASE}/agent/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: agentName, policy }),
      });

      if (res.ok) {
        const data: CreateAgentResponse = await res.json();
        setNewAgentResult(data);
        setMessage({ type: "success", text: "Agent created! Copy the token below - it won't be shown again." });
        await fetchAgents();
        setShowCreateForm(false);
      } else {
        const error = await res.json();
        setMessage({ type: "error", text: error.message ?? "Failed to create agent" });
      }
    } catch (e) {
      console.error("Failed to create agent:", e);
      setMessage({ type: "error", text: "Failed to create agent" });
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: "success", text: "Copied to clipboard!" });
    setTimeout(() => setMessage(null), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (loading) {
    return (
      <main className="container agents-page">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </main>
    );
  }

  return (
    <main className="container agents-page">
      <Link href="/" className="back-link">
        ← Back to Marketplace
      </Link>

      <div className="agents-header">
        <div>
          <h1>🤖 Agent Tokens</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Create tokens for AI agents with scoped spend policies
          </p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? "Cancel" : "+ Create Agent"}
        </button>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* New Agent Result */}
      {newAgentResult && (
        <div className="new-agent-card">
          <h3>🎉 Agent Created!</h3>
          <p style={{ color: "var(--warning)", marginBottom: "1rem" }}>
            ⚠️ Save this token now - it won&apos;t be shown again!
          </p>
          
          <div className="token-display">
            <code>{newAgentResult.agentToken}</code>
            <button 
              className="btn btn-sm" 
              onClick={() => copyToClipboard(newAgentResult.agentToken)}
            >
              Copy
            </button>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <p style={{ fontWeight: 500, marginBottom: "0.5rem" }}>Example usage:</p>
            <pre className="curl-example">
              {newAgentResult.curl}
            </pre>
            <button 
              className="btn btn-sm btn-secondary" 
              onClick={() => copyToClipboard(newAgentResult.curl)}
            >
              Copy curl command
            </button>
          </div>

          <button 
            className="btn btn-ghost" 
            onClick={() => setNewAgentResult(null)}
            style={{ marginTop: "1rem" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="create-form">
          <h2>Create New Agent</h2>
          
          <div className="form-group">
            <label>Agent name</label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="My Agent"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Max per action ($)</label>
              <input
                type="number"
                step="0.01"
                value={maxPerAction}
                onChange={(e) => setMaxPerAction(e.target.value)}
                placeholder="1.00"
              />
            </div>

            <div className="form-group">
              <label>Daily cap ($)</label>
              <input
                type="number"
                step="0.01"
                value={dailyCap}
                onChange={(e) => setDailyCap(e.target.value)}
                placeholder="5.00"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Allowed paths</label>
            <input
              type="text"
              value={allowedPaths}
              onChange={(e) => setAllowedPaths(e.target.value)}
              placeholder="/article/*"
            />
            <span className="help-text">Comma-separated. Use * for wildcards.</span>
          </div>

          <button 
            className="btn btn-primary" 
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? "Creating..." : "Create Agent"}
          </button>
        </div>
      )}

      {/* Agents List */}
      <div className="agents-list">
        <h2>Your Agents ({agents.length})</h2>
        
        {agents.length === 0 ? (
          <div className="empty-state">
            <p>No agents yet. Create one to get started!</p>
          </div>
        ) : (
          agents.map((agent) => (
            <div key={agent.agentId} className="agent-card">
              <div className="agent-header">
                <div>
                  <h3>{agent.name}</h3>
                  <span className="agent-id">{agent.agentId}</span>
                </div>
                <span className="token-preview">{agent.tokenPreview}</span>
              </div>
              
              <div className="agent-policy">
                <span>Max: {formatCents(agent.policy.maxPerActionCents)}/action</span>
                <span>•</span>
                <span>Cap: {formatCents(agent.policy.dailyCapCents)}/day</span>
                <span>•</span>
                <span>Paths: {agent.policy.allowedPaths.join(", ")}</span>
              </div>
              
              <div className="agent-meta">
                <span>Created: {formatDate(agent.createdAt)}</span>
                {agent.lastUsedAt && (
                  <span>Last used: {formatDate(agent.lastUsedAt)}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: "2rem" }}>
        <Link href="/settings" className="btn btn-secondary">
          ← Back to Settings
        </Link>
      </div>

      <style jsx>{`
        .agents-page {
          max-width: 700px;
          margin: 0 auto;
          padding: 2rem;
        }

        .agents-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
        }

        .agents-header h1 {
          margin-bottom: 0.25rem;
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

        .new-agent-card {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
          border: 1px solid var(--primary);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .new-agent-card h3 {
          margin-bottom: 0.5rem;
        }

        .token-display {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          background: var(--bg-secondary);
          padding: 1rem;
          border-radius: 8px;
          overflow-x: auto;
        }

        .token-display code {
          flex: 1;
          font-family: monospace;
          font-size: 0.875rem;
          word-break: break-all;
        }

        .curl-example {
          background: var(--bg-secondary);
          padding: 1rem;
          border-radius: 8px;
          font-size: 0.75rem;
          overflow-x: auto;
          margin-bottom: 0.5rem;
        }

        .create-form {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .create-form h2 {
          margin-bottom: 1rem;
          font-size: 1.125rem;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-group {
          margin-bottom: 1rem;
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

        .agents-list {
          margin-top: 2rem;
        }

        .agents-list h2 {
          font-size: 1.125rem;
          margin-bottom: 1rem;
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: var(--text-secondary);
          background: var(--bg-secondary);
          border-radius: 12px;
        }

        .agent-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1rem 1.5rem;
          margin-bottom: 1rem;
        }

        .agent-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.75rem;
        }

        .agent-header h3 {
          margin: 0;
          font-size: 1rem;
        }

        .agent-id {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-family: monospace;
        }

        .token-preview {
          font-family: monospace;
          font-size: 0.75rem;
          color: var(--text-secondary);
          background: var(--bg-secondary);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
        }

        .agent-policy {
          display: flex;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
          flex-wrap: wrap;
        }

        .agent-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .btn-sm {
          padding: 0.375rem 0.75rem;
          font-size: 0.875rem;
        }

        .btn-ghost {
          background: transparent;
          color: var(--text-secondary);
        }

        .btn-ghost:hover {
          background: var(--bg-secondary);
        }
      `}</style>
    </main>
  );
}
