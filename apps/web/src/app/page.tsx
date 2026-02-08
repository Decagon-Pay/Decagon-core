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
  CheckCircle,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { DecagonLogo } from "@/components/decagon-logo";
import { useState } from "react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.25, 0.4, 0.25, 1] as const },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.4, 0.25, 1] as const } },
};

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

type MockStep = "choose" | "form" | "processing" | "success";

function InteractivePaymentMock() {
  const [selected, setSelected] = useState<"wallet" | "mock" | null>(null);
  const [step, setStep] = useState<MockStep>("choose");

  const handleConfirm = () => {
    setStep("processing");
    setTimeout(() => setStep("success"), 2000);
  };

  const handleReset = () => {
    setSelected(null);
    setStep("choose");
  };

  return (
    <div className="relative">
      <div className="rounded-2xl border bg-card shadow-xl overflow-hidden">
        {/* Sheet header */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-center">
          <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
            {step === "success" ? (
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            ) : (
              <CreditCard className="h-5 w-5 text-white" />
            )}
          </div>
          <h4 className="text-white font-semibold">
            {step === "success" ? "Payment Complete!" : "Unlock: Premium Article"}
          </h4>
          <p className="text-slate-400 text-sm mt-1">
            {step === "success"
              ? "5 credits added to your account"
              : "5 credits for $0.50 USDT"}
          </p>
        </div>

        <div className="p-5 space-y-3">
          {/* ── Success state ── */}
          {step === "success" && (
            <>
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Receipt ID</span>
                  <span className="font-mono text-xs">rcpt_demo_7f3a</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold">$0.50 USDT</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Credits</span>
                  <Badge variant="success" className="gap-1 text-xs">
                    <CheckCircle className="h-3 w-3" /> 5 credits
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Confirmed</span>
                </div>
              </div>
              <Button
                className="w-full mt-2 gap-2"
                size="lg"
                variant="outline"
                onClick={handleReset}
              >
                <RotateCcw className="h-4 w-4" />
                Try Again
              </Button>
            </>
          )}

          {/* ── Processing state ── */}
          {step === "processing" && (
            <div className="py-8 flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium text-sm">Verifying payment...</p>
                <p className="text-xs text-muted-foreground mt-1">Confirming on Plasma Testnet</p>
              </div>
            </div>
          )}

          {/* ── Choose / Form states ── */}
          {(step === "choose" || step === "form") && (
            <>
              {/* Wallet option (not clickable) */}
              <div
                className={`rounded-xl border-2 p-4 transition-all duration-200 ${
                  selected === null
                    ? "border-primary bg-primary/5 cursor-default"
                    : selected === "wallet"
                    ? "border-primary bg-primary/5 cursor-default"
                    : "border-muted bg-transparent cursor-default opacity-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <path d="M20.5 7H3.5C2.67 7 2 7.67 2 8.5V18.5C2 19.33 2.67 20 3.5 20H20.5C21.33 20 22 19.33 22 18.5V8.5C22 7.67 21.33 7 20.5 7Z" stroke="currentColor" strokeWidth="1.5" className="text-orange-500" />
                      <path d="M17 13.5C17 14.33 17.67 15 18.5 15H22V12H18.5C17.67 12 17 12.67 17 13.5Z" fill="currentColor" className="text-orange-500" />
                      <path d="M22 7V5.5C22 4.67 21.33 4 20.5 4H5L22 7Z" stroke="currentColor" strokeWidth="1.5" className="text-orange-500" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">Pay with Wallet</div>
                    <div className="text-xs text-muted-foreground">MetaMask, Rabby, etc.</div>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                    Recommended
                  </Badge>
                </div>
              </div>

              {/* Mock card option (clickable) */}
              <div
                onClick={() => {
                  setSelected("mock");
                  setStep("form");
                }}
                className={`rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer hover:shadow-sm ${
                  selected === "mock"
                    ? "border-blue-500 bg-blue-500/5"
                    : "border-transparent hover:border-blue-300 dark:hover:border-blue-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">Mock Payment</div>
                    <div className="text-xs text-muted-foreground">For testing and demos</div>
                  </div>
                  {selected === "mock" && (
                    <CheckCircle className="h-5 w-5 text-blue-500" />
                  )}
                </div>
              </div>

              {/* Expanded card details form */}
              {step === "form" && (
                <div className="rounded-xl border bg-muted/40 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Name on Card
                    </label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Card Number
                    </label>
                    <input
                      type="text"
                      placeholder="4242 4242 4242 4242"
                      maxLength={19}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors tracking-wider"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        placeholder="MM / YY"
                        maxLength={7}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                        CVC
                      </label>
                      <input
                        type="text"
                        placeholder="123"
                        maxLength={4}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold">$0.50 USDT</span>
                  </div>
                </div>
              )}

              {/* Confirm button */}
              <Button
                className="w-full mt-2 gap-2"
                size="lg"
                disabled={step !== "form"}
                onClick={handleConfirm}
              >
                <Shield className="h-4 w-4" />
                Confirm Payment
              </Button>
            </>
          )}

          <p className="text-center text-xs text-muted-foreground pt-1">
            Secured by Plasma Network
          </p>
        </div>
      </div>

      {/* Decorative glow */}
      <div className="absolute -inset-4 bg-gradient-to-br from-blue-500/5 to-violet-500/5 rounded-3xl -z-10" />
    </div>
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
          <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp}>
            <Badge
              variant="secondary"
              className="mb-6 bg-white/10 text-white border-white/20 hover:bg-white/15"
            >
              <Zap className="h-3 w-3 mr-1.5" />
              Built on Plasma Testnet
            </Badge>
          </motion.div>

          <motion.h1
            initial="hidden" animate="visible" custom={1} variants={fadeUp}
            className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.1]"
          >
            Stripe Checkout for{" "}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              Plasma Payments
            </span>
          </motion.h1>

          <motion.p
            initial="hidden" animate="visible" custom={2} variants={fadeUp}
            className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed"
          >
            One component turns any HTTP resource into a paywall.
            Instant onchain settlement, agent-native spend limits,
            and verifiable receipts. No accounts required.
          </motion.p>

          <motion.div
            initial="hidden" animate="visible" custom={3} variants={fadeUp}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
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
          </motion.div>

          <motion.div
            initial="hidden" animate="visible" custom={4} variants={fadeUp}
            className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto"
          >
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
          </motion.div>
        </div>
      </section>

      {/* ═══ PAYMENT FLOW ═══════════════════════════════════ */}
      <section className="py-24 sm:py-32 bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
            className="text-center mb-14"
          >
            <motion.div variants={staggerItem}>
              <Badge variant="muted" className="mb-4">
                Payment Flow
              </Badge>
            </motion.div>
            <motion.h2 variants={staggerItem} className="text-3xl sm:text-4xl font-bold tracking-tight">
              From request to receipt in seconds
            </motion.h2>
            <motion.p variants={staggerItem} className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Four steps turn any HTTP resource into a paid endpoint
              with onchain proof.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}
            variants={staggerContainer}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
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
              <motion.div key={s.step} variants={staggerItem} className="relative">
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
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ DEVELOPER SDK ══════════════════════════════════ */}
      <section className="py-24 sm:py-32 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
            className="text-center mb-14"
          >
            <motion.div variants={staggerItem}>
              <Badge variant="muted" className="mb-4">
                <Code2 className="h-3 w-3 mr-1.5" />
                Developer SDK
              </Badge>
            </motion.div>
            <motion.h2 variants={staggerItem} className="text-3xl sm:text-4xl font-bold tracking-tight">
              Add payments in minutes, not months
            </motion.h2>
            <motion.p variants={staggerItem} className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Install the SDK, drop in the PaymentSheet component, and start
              collecting stablecoin payments on Plasma.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.15 } } }}
            className="grid lg:grid-cols-2 gap-10 max-w-5xl mx-auto items-start"
          >
            {/* Left column: Install + Usage code */}
            <motion.div variants={staggerItem} className="space-y-6">
              {/* Install */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  1. Install
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
                  2. Integrate
                </h3>
                <div className="code-block text-sm leading-relaxed">
                  <pre>{`import { PaymentSheet } from "@decagon/ui";

// When your API returns HTTP 402:
<PaymentSheet
  challenge={challenge}
  config={{
    apiBase: "https://api.example.com",
    plasmaChainId: 9746,
    explorerTxBase: "https://testnet.plasmascan.to/tx/",
  }}
  onSuccess={(receipt, session) => {
    console.log("Paid!", receipt.txHash);
    // re-fetch your resource with session token
  }}
/>`}</pre>
                </div>
              </div>

              {/* Key points */}
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>MetaMask wallet connection built in</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>USDT on Plasma with sub-second finality</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>Verifiable receipts with on-chain explorer links</span>
                </div>
              </div>
            </motion.div>

            {/* Right column: Interactive PaymentSheet mock */}
            <motion.div variants={staggerItem}>
              <InteractivePaymentMock />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══════════════════════════════════ */}
      <section className="py-24 sm:py-32 bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
            className="text-center mb-14"
          >
            <motion.div variants={staggerItem}>
              <Badge variant="muted" className="mb-4">
                How It Works
              </Badge>
            </motion.div>
            <motion.h2 variants={staggerItem} className="text-3xl sm:text-4xl font-bold tracking-tight">
              Three primitives, infinite possibilities
            </motion.h2>
            <motion.p variants={staggerItem} className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Decagon implements the HTTP 402 Payment Required standard
              with onchain settlement on Plasma.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-6"
          >
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
              <motion.div key={feature.title} variants={staggerItem}>
              <Card
                className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full"
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
              </motion.div>
            ))}
          </motion.div>

          {/* Trust signals */}
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}
            variants={staggerContainer}
            className="mt-10 grid sm:grid-cols-3 gap-6"
          >
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
              <motion.div
                key={item.title}
                variants={staggerItem}
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
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ LIVE DEMOS ═════════════════════════════════════ */}
      <section className="py-24 sm:py-32 bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
            className="text-center mb-14"
          >
            <motion.div variants={staggerItem}>
              <Badge variant="muted" className="mb-4">
                Live Demos
              </Badge>
            </motion.div>
            <motion.h2 variants={staggerItem} className="text-3xl sm:text-4xl font-bold tracking-tight">
              See it in action
            </motion.h2>
            <motion.p variants={staggerItem} className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Fully working demos of Decagon-powered payment flows.
              Try them now, no setup required.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto"
          >
            {/* News Paywall Demo */}
            <motion.div variants={staggerItem}>
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
            </motion.div>

            {/* Remittance Demo */}
            <motion.div variants={staggerItem}>
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
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══ CTA ════════════════════════════════════════════ */}
      <section className="py-24 sm:py-32 bg-background">
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
          className="mx-auto max-w-3xl px-4 sm:px-6 text-center"
        >
          <motion.div variants={staggerItem}>
            <DecagonLogo className="h-12 w-12 text-primary mx-auto mb-6" />
          </motion.div>
          <motion.h2 variants={staggerItem} className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Ready to add payments?
          </motion.h2>
          <motion.p variants={staggerItem} className="text-muted-foreground mb-10 max-w-lg mx-auto">
            Decagon makes it trivial to monetize any HTTP resource with onchain
            payments on Plasma. Try the demos or start building with the SDK.
          </motion.p>
          <motion.div variants={staggerItem} className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
