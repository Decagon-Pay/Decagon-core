"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Bot,
  Shield,
  ArrowRight,
} from "lucide-react";

interface SpendPolicy {
  maxPerActionCents: number;
  dailyCapCents: number;
  autoApproveUnderCents: number;
  requireConfirmAboveCents: number;
  allowedOrigins: string[];
  allowedPaths: string[];
}

export default function SettingsPage() {
  const [policy, setPolicy] = useState<SpendPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
        setMaxPerAction((data.policy.maxPerActionCents / 100).toString());
        setDailyCap((data.policy.dailyCapCents / 100).toString());
        setAutoApproveUnder(
          (data.policy.autoApproveUnderCents / 100).toString()
        );
        setRequireConfirmAbove(
          (data.policy.requireConfirmAboveCents / 100).toString()
        );
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
        autoApproveUnderCents: Math.round(
          parseFloat(autoApproveUnder) * 100
        ),
        requireConfirmAboveCents: Math.round(
          parseFloat(requireConfirmAbove) * 100
        ),
        allowedOrigins: allowedOrigins
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        allowedPaths: allowedPaths
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
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
        setMessage({
          type: "error",
          text: error.message ?? "Failed to save policy",
        });
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
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="h-5 w-5 text-primary" />
          <Badge variant="muted">Settings</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Spend Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Configure your payment limits and allowlists.
        </p>
      </div>

      {/* Status message */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 mb-6 text-sm ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-200"
              : "bg-red-500/10 text-red-600 border border-red-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Spend limits */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Spend Limits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Max per action ($)
            </label>
            <Input
              type="number"
              step="0.01"
              value={maxPerAction}
              onChange={(e) => setMaxPerAction(e.target.value)}
              placeholder="5.00"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum amount allowed for a single payment
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Daily cap ($)
            </label>
            <Input
              type="number"
              step="0.01"
              value={dailyCap}
              onChange={(e) => setDailyCap(e.target.value)}
              placeholder="20.00"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum total spend per day
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Auto-approve under ($)
            </label>
            <Input
              type="number"
              step="0.01"
              value={autoApproveUnder}
              onChange={(e) => setAutoApproveUnder(e.target.value)}
              placeholder="1.00"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Skip confirmation for amounts under this threshold
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Require confirm above ($)
            </label>
            <Input
              type="number"
              step="0.01"
              value={requireConfirmAbove}
              onChange={(e) => setRequireConfirmAbove(e.target.value)}
              placeholder="2.00"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Always require checkbox confirmation above this amount
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Allowlists */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Allowlists</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Allowed origins
            </label>
            <Input
              value={allowedOrigins}
              onChange={(e) => setAllowedOrigins(e.target.value)}
              placeholder="*, http://localhost:3000"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Comma-separated list of allowed origins (* = all)
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Allowed paths
            </label>
            <Input
              value={allowedPaths}
              onChange={(e) => setAllowedPaths(e.target.value)}
              placeholder="/article/*, /api/*"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Comma-separated list of allowed paths (* = wildcard)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end mb-8">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </div>

      {/* Raw policy */}
      {policy && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Current Policy (raw)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-auto">
              {JSON.stringify(policy, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Link to agents */}
      <Link href="/agents">
        <Button variant="outline" className="gap-2">
          <Bot className="h-4 w-4" />
          Manage Agents
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
