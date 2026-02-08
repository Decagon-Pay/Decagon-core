"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Newspaper,
  ArrowRight,
  Shield,
  Zap,
  Receipt,
  CreditCard,
  Bot,
  Send,
  Code2,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Lock,
} from "lucide-react";
import { DecagonLogo } from "@/components/decagon-logo";
import { useState } from "react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-400" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}

export default function LandingPage() {
  return (
    <div className="-mt-16">
      {/* ─── Hero ─────────────────────────────────────────── */}
      <section className="gradient-hero relative overflow-hidden pt-32 pb-24 sm:pt-40 sm:pb-32">
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 grid-pattern opacity-20" />
        {/* Gradient orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-[120px]" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 text-center">
          <Badge
            variant="secondary"
            className="mb-6 bg-white/10 text-white border-white/20 hover:bg-white/15"
          >
            <Zap className="h-3 w-3 mr-1.5" />
            Built on Plasma Testnet
          </Badge>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.1]">
            Stripe Checkout for{" "}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              HTTP 402
            </span>{" "}
            Payments
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Instant onchain settlement, agent-native spend limits, and
            verifiable receipts. No accounts required — just tap, pay, and
            access.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/news">
              <Button
                size="xl"
                className="gap-2.5 shadow-lg shadow-blue-500/25"
              >
                <Newspaper className="h-5 w-5" />
                Try News Demo
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/remittance">
              <Button
                size="xl"
                variant="outline"
                className="gap-2.5 border-white/25 text-white hover:bg-white/10 bg-transparent"
              >
                <Send className="h-5 w-5" />
                Try Remittance
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
            {[
              { value: "< 2s", label: "Settlement" },
              { value: "$0.01", label: "Min payment" },
              { value: "402", label: "Status code" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl sm:text-3xl font-bold text-white">
                  {stat.value}
                </div>
                <div className="text-sm text-slate-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ────────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-16">
            <Badge variant="muted" className="mb-4">
              How it works
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Three primitives, infinite possibilities
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Decagon implements the HTTP 402 Payment Required flow with onchain
              settlement on Plasma.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Lock,
                title: "Paywalls Without Accounts",
                desc: "Any HTTP resource can return 402 with a payment challenge. Users pay with a single click — no signup, no login, no subscription.",
                badge: "HTTP 402",
                gradient: "from-blue-500/10 to-blue-600/5",
              },
              {
                icon: Shield,
                title: "Agent Budgets & Allowlists",
                desc: "Issue scoped API tokens for AI agents with per-action limits, daily caps, and path-based allowlists. Agents pay autonomously within guardrails.",
                badge: "Spend Policy",
                gradient: "from-violet-500/10 to-violet-600/5",
              },
              {
                icon: Receipt,
                title: "Receipts & Verification",
                desc: "Every payment produces a verifiable receipt with txHash, block number, and explorer link. Idempotent retries return the same receipt.",
                badge: "On-chain",
                gradient: "from-emerald-500/10 to-emerald-600/5",
              },
            ].map((feature) => (
              <Card
                key={feature.title}
                className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity`}
                />
                <CardContent className="relative p-6 pt-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <Badge variant="secondary" className="mb-3 text-xs">
                    {feature.badge}
                  </Badge>
                  <h3 className="text-lg font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Flow diagram ────────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-16">
            <Badge variant="muted" className="mb-4">
              Payment Flow
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              From request to receipt in seconds
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                step: "1",
                title: "Request",
                desc: "Client requests a protected resource via HTTP GET",
                code: "GET /article/42",
              },
              {
                step: "2",
                title: "402 Challenge",
                desc: "Server returns payment challenge with amount and address",
                code: "HTTP 402 + Challenge",
              },
              {
                step: "3",
                title: "Pay on Plasma",
                desc: "User approves a native transaction on Plasma testnet",
                code: "eth_sendTransaction",
              },
              {
                step: "4",
                title: "Verify & Access",
                desc: "Server verifies tx, mints credits, returns full content",
                code: "POST /pay/verify → 200",
              },
            ].map((s) => (
              <div key={s.step} className="relative">
                <Card className="h-full">
                  <CardContent className="p-5 pt-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-white">
                        {s.step}
                      </div>
                      <h3 className="font-semibold">{s.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {s.desc}
                    </p>
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                      {s.code}
                    </code>
                  </CardContent>
                </Card>
                {s.step !== "4" && (
                  <ChevronRight className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Use Cases / Demos ───────────────────────────── */}
      <section className="py-20 sm:py-28 bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-16">
            <Badge variant="muted" className="mb-4">
              Live Demos
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              See it in action
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Explore real, working demos of Decagon-powered payment flows.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* News Demo */}
            <Link href="/news" className="no-underline group">
              <Card className="h-full overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="h-40 gradient-primary flex items-center justify-center">
                  <Newspaper className="h-16 w-16 text-white/80" />
                </div>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                    News Paywall Demo
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    A premium publisher with article-level micropayments. Pay
                    $0.50–$1.00 to unlock full content.
                  </p>
                  <div className="flex items-center text-sm font-medium text-primary">
                    Try it now{" "}
                    <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Remittance Demo */}
            <Link href="/remittance" className="no-underline group">
              <Card className="h-full overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="h-40 bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Send className="h-16 w-16 text-white/80" />
                </div>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                    Remittance Demo
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Send funds to any Plasma address using the same Decagon
                    Payment Sheet with full receipts.
                  </p>
                  <div className="flex items-center text-sm font-medium text-primary">
                    Try it now{" "}
                    <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Agent Demo */}
            <Link href="/agents" className="no-underline group">
              <Card className="h-full overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="h-40 bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Bot className="h-16 w-16 text-white/80" />
                </div>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                    Agent Tokens
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create scoped API tokens for AI agents with daily caps,
                    per-action limits, and allowlists.
                  </p>
                  <div className="flex items-center text-sm font-medium text-primary">
                    Try it now{" "}
                    <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── SDK Section ─────────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-16">
            <Badge variant="muted" className="mb-4">
              <Code2 className="h-3 w-3 mr-1.5" />
              Developer SDK
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Add payments in 5 lines of code
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Install the SDK, drop in the PaymentSheet, and start collecting
              payments.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Install */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Install
              </h3>
              <div className="code-block flex items-center justify-between">
                <code>pnpm add @decagon/ui</code>
                <CopyButton text="pnpm add @decagon/ui" />
              </div>

              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-8 mb-3">
                Usage
              </h3>
              <div className="code-block text-sm leading-relaxed">
                <pre>{`import { PaymentSheet } from "@decagon/ui";

<PaymentSheet
  challenge={challenge}
  config={{
    apiBase: "https://api.example.com",
    plasmaChainId: 9746,
    explorerTxBase: "https://testnet.plasmascan.to/tx/",
  }}
  onSuccess={(receipt, session) => {
    console.log("Paid!", receipt.receiptId);
  }}
  onClose={() => setOpen(false)}
/>`}</pre>
              </div>
            </div>

            {/* Component preview */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Preview
              </h3>
              <Card className="overflow-hidden">
                <div className="bg-black/5 p-1">
                  <div className="flex gap-1.5 px-3 py-2">
                    <div className="w-3 h-3 rounded-full bg-red-400/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
                    <div className="w-3 h-3 rounded-full bg-green-400/50" />
                  </div>
                </div>
                <CardContent className="p-6">
                  {/* Mock PaymentSheet preview */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <DecagonLogo className="h-6 w-6 text-primary" />
                      <span className="font-semibold">Decagon Payment</span>
                    </div>
                    <Badge variant="secondary">Demo</Badge>
                  </div>
                  <Separator className="mb-4" />
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Credits</span>
                      <span className="font-semibold">10</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Price</span>
                      <span className="font-semibold">$0.50</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pay with</span>
                      <span className="font-mono text-xs">0.000283 XPL</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Chain</span>
                      <Badge variant="outline" className="text-xs">
                        Plasma Testnet
                      </Badge>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <Button className="w-full gap-2" disabled>
                    <CreditCard className="h-4 w-4" />
                    Pay with MetaMask
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full mt-2 gap-2"
                    disabled
                  >
                    Pay $0.50 (Demo Mode)
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <DecagonLogo className="h-12 w-12 text-primary mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Ready to add payments?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Decagon makes it trivial to monetize any HTTP resource with onchain
            payments. Try the demos or start building with the SDK.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/news">
              <Button size="lg" className="gap-2">
                Explore Demos <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="https://github.com" target="_blank">
              <Button size="lg" variant="outline" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                View on GitHub
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
