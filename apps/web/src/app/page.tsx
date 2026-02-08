"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  FileCheck,
  ShieldCheck,
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
      {/* ═══ HERO ═══════════════════════════════════════════ */}
      <section className="gradient-hero relative overflow-hidden pt-36 pb-28 sm:pt-44 sm:pb-36">
        <div className="absolute inset-0 grid-pattern opacity-20" />
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
              Plasma Payments
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            One component turns any HTTP resource into a paywall.
            Instant onchain settlement, agent-native spend limits,
            and verifiable receipts. No accounts required.
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

      {/* ═══ PAYMENT FLOW ═══════════════════════════════════ */}
      <section className="py-24 sm:py-32 bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-14">
            <Badge variant="muted" className="mb-4">
              Payment Flow
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              From request to receipt in seconds
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Four steps turn any HTTP resource into a paid endpoint
              with onchain proof.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                step: "1",
                title: "Request",
                code: "GET /article/42",
                color: "from-blue-500 to-blue-600",
              },
              {
                step: "2",
                title: "402 Challenge",
                code: "HTTP 402 + Challenge",
                color: "from-violet-500 to-violet-600",
              },
              {
                step: "3",
                title: "Receipt",
                code: "POST /pay/verify",
                color: "from-emerald-500 to-emerald-600",
              },
              {
                step: "4",
                title: "Access Granted",
                code: "200 OK + Content",
                color: "from-green-500 to-green-600",
              },
            ].map((s, i) => (
              <div key={s.step} className="relative">
                <Card className="h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                  <CardContent className="p-5 pt-5 text-center">
                    <div
                      className={`mx-auto h-10 w-10 rounded-full bg-gradient-to-br ${s.color} flex items-center justify-center text-sm font-bold text-white mb-3`}
                    >
                      {s.step}
                    </div>
                    <h3 className="font-semibold mb-2">{s.title}</h3>
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                      {s.code}
                    </code>
                  </CardContent>
                </Card>
                {i < 3 && (
                  <ChevronRight className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 z-10" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ DEVELOPER SDK ══════════════════════════════════ */}
      <section className="py-24 sm:py-32 bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-14">
            <Badge variant="muted" className="mb-4">
              <Code2 className="h-3 w-3 mr-1.5" />
              Developer SDK
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Add payments in minutes, not months
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Install the SDK, drop in the PaymentSheet component, and start
              collecting stablecoin payments on Plasma.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Install */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Install
              </h3>
              <div className="code-block flex items-center justify-between">
                <code>pnpm add @decagon/ui</code>
                <CopyButton text="pnpm add @decagon/ui" />
              </div>
            </div>

            {/* Usage */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Code2 className="h-4 w-4" />
                Usage
              </h3>
              <div className="code-block text-sm leading-relaxed">
                <pre>{`<PaymentSheet
  challenge={challenge}
  onSuccess={(receipt) => {
    console.log("Paid!", receipt.receiptId);
  }}
/>`}</pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══════════════════════════════════ */}
      <section className="py-24 sm:py-32 bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-14">
            <Badge variant="muted" className="mb-4">
              How It Works
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Three primitives, infinite possibilities
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Decagon implements the HTTP 402 Payment Required standard
              with onchain settlement on Plasma.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Lock,
                title: "Paywalls Without Accounts",
                desc: "Any HTTP resource can return 402 with a payment challenge. Users pay with a single click. No signup, no login, no subscription.",
                badge: "HTTP 402",
                gradient: "from-blue-500/10 to-blue-600/5",
              },
              {
                icon: Shield,
                title: "Agent Budgets and Allowlists",
                desc: "Issue scoped API tokens for AI agents with per-action limits, daily caps, and path-based allowlists. Agents pay autonomously within guardrails.",
                badge: "Spend Policy",
                gradient: "from-violet-500/10 to-violet-600/5",
              },
              {
                icon: Receipt,
                title: "Receipts and Verification",
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

          {/* Trust signals */}
          <div className="mt-10 grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: FileCheck,
                title: "Idempotent Verification",
                desc: "Duplicate verify requests return the original receipt without minting extra credits.",
              },
              {
                icon: ShieldCheck,
                title: "Session Persistence",
                desc: "Tokens survive page refreshes and server restarts. Lost sessions are automatically recovered.",
              },
              {
                icon: Bot,
                title: "Agent-Native",
                desc: "AI agents can pay autonomously using scoped tokens with daily caps and per-action limits.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex gap-4 p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
              >
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1">{item.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ LIVE DEMOS ═════════════════════════════════════ */}
      <section className="py-24 sm:py-32 bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-14">
            <Badge variant="muted" className="mb-4">
              Live Demos
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              See it in action
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Fully working demos of Decagon-powered payment flows.
              Try them now, no setup required.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* News Paywall Demo */}
            <Link href="/news" className="no-underline group">
              <Card className="h-full overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="h-44 gradient-primary flex items-center justify-center relative">
                  <Newspaper className="h-16 w-16 text-white/70" />
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white/20 text-white border-white/30">
                      HTTP 402
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-8">
                  <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                    News Paywall Demo
                  </h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed text-sm">
                    A premium publisher with article-level micropayments. Browse
                    free previews, then pay to unlock full articles.
                  </p>
                  <Button className="w-full gap-2 group-hover:shadow-md transition-shadow">
                    Open Demo
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            </Link>

            {/* Remittance Demo */}
            <Link href="/remittance" className="no-underline group">
              <Card className="h-full overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="h-44 bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center relative">
                  <Send className="h-16 w-16 text-white/70" />
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white/20 text-white border-white/30">
                      Remittance
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-8">
                  <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                    Remittance Demo
                  </h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed text-sm">
                    Send stablecoin payments to any Plasma address with full
                    receipts, spend policy enforcement, and history.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full gap-2 group-hover:shadow-md transition-shadow"
                  >
                    Open Demo
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ CTA ════════════════════════════════════════════ */}
      <section className="py-24 sm:py-32 bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <DecagonLogo className="h-12 w-12 text-primary mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Ready to add payments?
          </h2>
          <p className="text-muted-foreground mb-10 max-w-lg mx-auto">
            Decagon makes it trivial to monetize any HTTP resource with onchain
            payments on Plasma. Try the demos or start building with the SDK.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/news">
              <Button size="lg" className="gap-2">
                Explore Demos <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="https://github.com/Decagon-Pay" target="_blank">
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
