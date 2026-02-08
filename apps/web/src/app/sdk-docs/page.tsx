"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  BookOpen,
  Code2,
  Settings2,
  Package,
  Zap,
  Copy,
  Check,
  ArrowRight,
  Terminal,
  FileCode,
  Layers,
  Shield,
} from "lucide-react";

/* ─── Code snippets ─── */

const INSTALL_SNIPPET = `# pnpm (recommended)
pnpm add @decagon/ui

# npm
npm install @decagon/ui`;

const CONFIG_SNIPPET = `// lib/config.ts
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export const PLASMA_CHAIN_ID =
  parseInt(process.env.NEXT_PUBLIC_PLASMA_CHAIN_ID ?? "9746", 10);

export const PLASMA_EXPLORER_TX_BASE =
  process.env.NEXT_PUBLIC_PLASMA_EXPLORER_TX_BASE
    ?? "https://testnet.plasmascan.to/tx/";`;

const BASIC_USAGE_SNIPPET = `"use client";

import { PaymentSheet, useDecagonPayment } from "@decagon/ui";
import type { DecagonReceipt } from "@decagon/ui";
import { API_BASE, PLASMA_CHAIN_ID, PLASMA_EXPLORER_TX_BASE } from "@/lib/config";

export default function ArticlePage({ articleId }: { articleId: string }) {
  const payment = useDecagonPayment();

  const handleUnlock = async () => {
    // 1. Fetch the article — API returns a 402 challenge if unpaid
    const res = await fetch(\`\${API_BASE}/article/\${articleId}\`);
    const data = await res.json();

    if (data.challenge) {
      // 2. Open the PaymentSheet
      payment.open({
        challenge: data.challenge,
        config: {
          apiBase: API_BASE,
          plasmaChainId: PLASMA_CHAIN_ID,
          explorerTxBase: PLASMA_EXPLORER_TX_BASE,
        },
        purpose: "Unlock premium article",
        onSuccess: (receipt: DecagonReceipt, sessionToken: unknown) => {
          console.log("Paid!", receipt.receiptId);
          // Store sessionToken for re-access
        },
      });
    }
  };

  return (
    <>
      <button onClick={handleUnlock}>Unlock for $0.25</button>

      {payment.isOpen && payment.challenge && payment.config && (
        <PaymentSheet
          challenge={payment.challenge}
          config={payment.config}
          purpose={payment.purpose}
          existingSessionTokenId={payment.existingSessionTokenId}
          onClose={payment.close}
          onSuccess={payment.onSuccess}
        />
      )}
    </>
  );
}`;

const TRANSFER_SNIPPET = `"use client";

import { PaymentSheet, useDecagonPayment } from "@decagon/ui";
import { API_BASE, PLASMA_CHAIN_ID, PLASMA_EXPLORER_TX_BASE } from "@/lib/config";

export function TransferButton({ recipientAddress }: { recipientAddress: string }) {
  const payment = useDecagonPayment();

  const handleTransfer = async () => {
    const res = await fetch(\`\${API_BASE}/transfer/create\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientAddress }),
    });
    const { challenge } = await res.json();

    payment.open({
      challenge,
      config: {
        apiBase: API_BASE,
        plasmaChainId: PLASMA_CHAIN_ID,
        explorerTxBase: PLASMA_EXPLORER_TX_BASE,
      },
      purpose: "Send remittance",
      onSuccess: (receipt) => {
        console.log("Transfer confirmed:", receipt.txHash);
      },
    });
  };

  return (
    <>
      <button onClick={handleTransfer}>Send Funds</button>

      {payment.isOpen && payment.challenge && payment.config && (
        <PaymentSheet
          challenge={payment.challenge}
          config={payment.config}
          purpose={payment.purpose}
          onClose={payment.close}
          onSuccess={payment.onSuccess}
        />
      )}
    </>
  );
}`;

const TYPES_SNIPPET = `// All types are exported from @decagon/ui
import type {
  DecagonChallenge,        // Server-issued payment challenge
  DecagonReceipt,          // On-chain receipt after verification
  DecagonPolicyResult,     // Spend-policy check result
  DecagonSpendPolicy,      // Per-action + daily-cap limits
  DecagonPaymentConfig,    // API base URL + chain config
  OpenDecagonPaymentOptions, // Options for payment.open()
  PaymentSheetProps,       // Props for <PaymentSheet />
  UseDecagonPaymentReturn, // Return type of useDecagonPayment()
  PaymentStep,             // Internal UI step union
} from "@decagon/ui";`;

const ENV_SNIPPET = `# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_PLASMA_CHAIN_ID=9746
NEXT_PUBLIC_PLASMA_EXPLORER_TX_BASE=https://testnet.plasmascan.to/tx/`;

/* ─── Copy helper ─── */

function CopyBlock({ code, language = "tsx" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative group">
      <pre className="code-block text-[13px] leading-relaxed overflow-x-auto">
        <code>{code}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors opacity-0 group-hover:opacity-100"
        title="Copy"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-white/60" />
        )}
      </button>
    </div>
  );
}

/* ─── Page ─── */

export default function SdkDocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <Badge variant="muted">Developer</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">SDK Documentation</h1>
        <p className="mt-2 text-muted-foreground leading-relaxed">
          Integrate Decagon&apos;s payment sheet into any React application.
          One component, one hook — that&apos;s it.
        </p>
      </div>

      {/* Package info */}
      <Card className="mb-8 gradient-card">
        <CardContent className="py-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">@decagon/ui</p>
                <p className="text-xs text-muted-foreground">
                  v0.1.0 · MIT · React 18+
                </p>
              </div>
            </div>
            <CopyBlock code="pnpm add @decagon/ui" language="bash" />
          </div>
        </CardContent>
      </Card>

      {/* What you get */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">What&apos;s Included</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              icon: Layers,
              title: "<PaymentSheet />",
              desc: "Drop-in modal: email → policy check → confirm → pay → receipt.",
            },
            {
              icon: Zap,
              title: "useDecagonPayment()",
              desc: "React hook to manage sheet state, open/close, and handle callbacks.",
            },
            {
              icon: Shield,
              title: "Spend Policy",
              desc: "Built-in enforcement of per-action limits and daily caps.",
            },
            {
              icon: FileCode,
              title: "Full TypeScript",
              desc: "Every interface exported. Zero any types. IDE autocomplete works out of the box.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <Card key={title}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Icon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="mb-10" />

      {/* Installation + Config */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          Setup
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              1. Install
            </h3>
            <CopyBlock code={INSTALL_SNIPPET} language="bash" />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              2. Environment Variables
            </h3>
            <CopyBlock code={ENV_SNIPPET} language="bash" />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              3. Config Module
            </h3>
            <CopyBlock code={CONFIG_SNIPPET} language="ts" />
          </div>
        </div>
      </section>

      <Separator className="mb-10" />

      {/* Usage Examples */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Code2 className="h-5 w-5" />
          Usage
        </h2>

        <Tabs defaultValue="paywall" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="paywall">Article Paywall</TabsTrigger>
            <TabsTrigger value="transfer">Remittance</TabsTrigger>
            <TabsTrigger value="types">Type Imports</TabsTrigger>
          </TabsList>

          <TabsContent value="paywall" className="mt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Fetch an article, receive a 402 challenge, and open the
              PaymentSheet to collect payment.
            </p>
            <CopyBlock code={BASIC_USAGE_SNIPPET} />
          </TabsContent>

          <TabsContent value="transfer" className="mt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Create a transfer challenge and let the user pay via MetaMask
              or demo mode.
            </p>
            <CopyBlock code={TRANSFER_SNIPPET} />
          </TabsContent>

          <TabsContent value="types" className="mt-4">
            <p className="text-sm text-muted-foreground mb-3">
              All types are exported as named type exports for tree-shaking
              compatibility.
            </p>
            <CopyBlock code={TYPES_SNIPPET} />
          </TabsContent>
        </Tabs>
      </section>

      <Separator className="mb-10" />

      {/* Config Reference */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Configuration Reference
        </h2>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">DecagonPaymentConfig</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-semibold">Property</th>
                    <th className="pb-2 pr-4 font-semibold">Type</th>
                    <th className="pb-2 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs text-foreground">apiBase</td>
                    <td className="py-2 pr-4 font-mono text-xs">string</td>
                    <td className="py-2">Decagon API URL (e.g. <code className="text-xs bg-muted px-1 py-0.5 rounded">http://localhost:4000</code>)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs text-foreground">plasmaChainId</td>
                    <td className="py-2 pr-4 font-mono text-xs">number</td>
                    <td className="py-2">Plasma chain ID (<code className="text-xs bg-muted px-1 py-0.5 rounded">9746</code> for testnet)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs text-foreground">explorerTxBase</td>
                    <td className="py-2 pr-4 font-mono text-xs">string</td>
                    <td className="py-2">Block explorer base URL for transaction links</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">PaymentSheetProps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-semibold">Prop</th>
                    <th className="pb-2 pr-4 font-semibold">Type</th>
                    <th className="pb-2 pr-4 font-semibold">Required</th>
                    <th className="pb-2 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  {[
                    { prop: "challenge", type: "DecagonChallenge", req: "✓", desc: "Server-issued payment challenge" },
                    { prop: "config", type: "DecagonPaymentConfig", req: "✓", desc: "API base + chain config" },
                    { prop: "purpose", type: "string", req: "", desc: "Display label in the sheet header" },
                    { prop: "existingSessionTokenId", type: "string", req: "", desc: "Resume a prior session" },
                    { prop: "onClose", type: "() => void", req: "✓", desc: "Called when user dismisses the sheet" },
                    { prop: "onSuccess", type: "(receipt, token) => void", req: "✓", desc: "Called after verified payment" },
                  ].map((row) => (
                    <tr key={row.prop} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs text-foreground">{row.prop}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{row.type}</td>
                      <td className="py-2 pr-4 text-center">{row.req}</td>
                      <td className="py-2">{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator className="mb-10" />

      {/* Payment Flow */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Payment Flow</h2>
        <Card>
          <CardContent className="py-6">
            <div className="space-y-4">
              {[
                { n: "1", label: "Email Collection", desc: "User enters email (or resumes from localStorage)" },
                { n: "2", label: "Policy Check", desc: "SDK calls /policy/check to validate spend limits" },
                { n: "3", label: "Confirmation", desc: "Summary of amount, chain, recipient with explicit opt-in" },
                { n: "4", label: "Wallet Signing", desc: "MetaMask prompts for transaction, or demo-mode mock" },
                { n: "5", label: "On-Chain Verification", desc: "SDK calls /pay/verify — API confirms the tx on Plasma" },
                { n: "6", label: "Receipt", desc: "onSuccess fires with receipt + session token" },
              ].map(({ n, label, desc }) => (
                <div key={n} className="flex items-start gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0 mt-0.5">
                    {n}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA */}
      <Card className="gradient-card">
        <CardContent className="py-8 text-center">
          <h3 className="text-lg font-bold mb-2">Ready to integrate?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Check out the live demos to see the SDK in action.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link href="/news">
                News Paywall Demo <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/remittance">
                Remittance Demo <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
