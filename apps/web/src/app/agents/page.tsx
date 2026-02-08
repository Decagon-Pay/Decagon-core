"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Bot,
  Plus,
  X,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Shield,
  Clock,
  FileText,
  Send as SendIcon,
} from "lucide-react";
import { API_BASE } from "@/lib/config";

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
  agentToken?: string;
}

interface CreateAgentResponse {
  ok: boolean;
  agentId: string;
  agentToken: string;
  name: string;
  policy: SpendPolicy;
  curl: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAgentResult, setNewAgentResult] =
    useState<CreateAgentResponse | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form state
  const [agentName, setAgentName] = useState("My Agent");
  const [maxPerAction, setMaxPerAction] = useState("1.00");
  const [dailyCap, setDailyCap] = useState("5.00");
  const [allowedPaths, setAllowedPaths] = useState("/article/*, /transfer");

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
        autoApproveUnderCents: 50,
        requireConfirmAboveCents: 100,
        allowedOrigins: ["*"],
        allowedPaths: allowedPaths
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const res = await fetch(`${API_BASE}/agent/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: agentName, policy }),
      });

      if (res.ok) {
        const data: CreateAgentResponse = await res.json();
        setNewAgentResult(data);
        setMessage({
          type: "success",
          text: "Agent created! Copy the token below. It won't be shown again.",
        });
        await fetchAgents();
        setShowCreateForm(false);
      } else {
        const error = await res.json();
        setMessage({
          type: "error",
          text: error.message ?? "Failed to create agent",
        });
      }
    } catch (e) {
      console.error("Failed to create agent:", e);
      setMessage({ type: "error", text: "Failed to create agent" });
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Bot className="h-5 w-5 text-primary" />
            <Badge variant="muted">Agent Tokens</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Agent Tokens</h1>
          <p className="mt-2 text-muted-foreground">
            Create tokens for AI agents with scoped spend policies.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          variant={showCreateForm ? "outline" : "default"}
          className="gap-1.5 shrink-0"
        >
          {showCreateForm ? (
            <>
              <X className="h-4 w-4" /> Cancel
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> Create Agent
            </>
          )}
        </Button>
      </div>

      {/* Status message */}
      {message && (
        <div
          className={`flex items-start gap-2 rounded-lg p-3 mb-6 text-sm ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-200"
              : "bg-red-500/10 text-red-600 border border-red-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          )}
          {message.text}
        </div>
      )}

      {/* New Agent Result */}
      {newAgentResult && (
        <Card className="mb-8 border-primary/30 bg-gradient-to-br from-blue-500/5 to-violet-500/5">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-1">🎉 Agent Created!</h3>
            <p className="text-sm text-amber-600 flex items-center gap-1.5 mb-4">
              <AlertTriangle className="h-4 w-4" />
              Save this token now. It won&apos;t be shown again!
            </p>

            {/* Token display */}
            <div className="flex items-center gap-2 bg-muted rounded-lg p-3 mb-4">
              <code className="flex-1 text-sm font-mono break-all">
                {newAgentResult.agentToken}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  copyToClipboard(newAgentResult.agentToken, "token")
                }
                className="shrink-0"
              >
                {copiedField === "token" ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* cURL example */}
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                Example usage:
              </p>
              <div className="bg-muted rounded-lg p-3 mb-2">
                <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                  {newAgentResult.curl}
                </pre>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  copyToClipboard(newAgentResult.curl, "curl")
                }
                className="gap-1.5"
              >
                {copiedField === "curl" ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Copy curl
              </Button>
            </div>

            <Separator className="my-4" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNewAgentResult(null)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Create New Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                Agent name
              </label>
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="My Agent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                  Max per action ($)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={maxPerAction}
                  onChange={(e) => setMaxPerAction(e.target.value)}
                  placeholder="1.00"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                  Daily cap ($)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={dailyCap}
                  onChange={(e) => setDailyCap(e.target.value)}
                  placeholder="5.00"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                Allowed paths
              </label>
              <Input
                value={allowedPaths}
                onChange={(e) => setAllowedPaths(e.target.value)}
                placeholder="/article/*"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Comma-separated. Use * for wildcards.
              </p>
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
              {creating ? "Creating…" : "Create Agent"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Agents List */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Your Agents ({agents.length})
        </h2>

        {agents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Bot className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No agents yet. Create one to get started!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <Card key={agent.agentId}>
                <CardContent className="p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{agent.name}</h3>
                      <span className="text-xs font-mono text-muted-foreground">
                        {agent.agentId}
                      </span>
                    </div>
                    <Badge
                      variant="secondary"
                      className="font-mono text-xs shrink-0"
                    >
                      {agent.tokenPreview}
                    </Badge>
                  </div>

                  {/* Policy */}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Shield className="h-3.5 w-3.5" />
                      Max: {formatCents(agent.policy.maxPerActionCents)}/action
                    </span>
                    <span>•</span>
                    <span>
                      Cap: {formatCents(agent.policy.dailyCapCents)}/day
                    </span>
                  </div>

                  {/* Capability badges */}
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {agent.policy.allowedPaths.some((p: string) =>
                      p.includes("article")
                    ) && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <FileText className="h-3 w-3" />
                        Articles
                      </Badge>
                    )}
                    {agent.policy.allowedPaths.some(
                      (p: string) =>
                        p.includes("transfer") || p === "*"
                    ) && (
                      <Badge variant="success" className="gap-1 text-xs">
                        <SendIcon className="h-3 w-3" />
                        Transfers
                      </Badge>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Created: {formatDate(agent.createdAt)}
                    </span>
                    {agent.lastUsedAt && (
                      <span>Last used: {formatDate(agent.lastUsedAt)}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Footer link */}
      <div className="mt-8">
        <Link href="/settings">
          <Button variant="outline" className="gap-2">
            <Shield className="h-4 w-4" />
            Spend Policy Settings
          </Button>
        </Link>
      </div>
    </div>
  );
}
