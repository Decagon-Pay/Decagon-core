"use client";

import { useState, useEffect, useCallback } from "react";
import { PaymentSheet, useDecagonPayment } from "@decagon/ui";
import type { DecagonChallenge, DecagonReceipt } from "@decagon/ui";
import {
  API_BASE,
  PLASMA_CHAIN_ID,
  PLASMA_EXPLORER_TX_BASE,
} from "@/lib/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Send,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Wallet,
  CreditCard,
  Plus,
  Shield,
  Globe,
  Zap,
  LogOut,
  ChevronRight,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Settings2,
} from "lucide-react";

import {
  getDemoSession,
  createDemoSession,
  clearDemoSession,
  type DemoUser,
} from "@/lib/demo-session";
import {
  getBalance,
  getTransactions,
  topUp,
  checkSpendPolicy,
  sendTransfer,
  resetLedger,
  type DemoTransaction,
} from "@/lib/demo-ledger";
import { DEMO_CONTACTS, type DemoContact } from "@/lib/demo-contacts";

/* ─── On-chain types (preserved from original) ─── */
interface TransferRecord {
  receiptId: string;
  resourceId: string;
  amountPaid: number;
  currency: string;
  transactionRef: string;
  verifiedAt: string;
  txHash?: string;
  explorerUrl?: string;
  payerAddress?: string;
  payeeAddress?: string;
}

const SESSION_KEY = "decagon_session_token";
function getStoredSessionTokenId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      const session = JSON.parse(stored);
      if (new Date(session.expiresAt) > new Date()) return session.tokenId;
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    localStorage.removeItem(SESSION_KEY);
  }
  return undefined;
}

/* ─── Default spend policy (demo) ─── */
const DEMO_POLICY = {
  maxPerActionCents: 50000, // $500
  dailyCapCents: 200000, // $2,000
};

const QUICK_AMOUNTS = [1000, 2500, 5000, 10000]; // cents

/* ═══════════════════════════════════════════════════════════
   RemittancePage — Fintech Demo
   ═══════════════════════════════════════════════════════════ */

export default function RemittancePage() {
  /* ── Demo state ── */
  const [user, setUser] = useState<DemoUser | null>(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<DemoTransaction[]>([]);
  const [hydrated, setHydrated] = useState(false);

  /* ── Auth dialog ── */
  const [authOpen, setAuthOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  /* ── Top-up dialog ── */
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpSuccess, setTopUpSuccess] = useState(false);

  /* ── Send flow ── */
  const [sendStep, setSendStep] = useState<
    "idle" | "contact" | "amount" | "confirm" | "success"
  >("idle");
  const [selectedContact, setSelectedContact] = useState<DemoContact | null>(
    null
  );
  const [sendAmount, setSendAmount] = useState("");
  const [sendNote, setSendNote] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<DemoTransaction | null>(null);

  /* ── Advanced on-chain ── */
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [onchainNote, setOnchainNote] = useState("");
  const [onchainLoading, setOnchainLoading] = useState(false);
  const [, setChallenge] = useState<DecagonChallenge | null>(null);
  const [onchainHistory, setOnchainHistory] = useState<TransferRecord[]>([]);
  const [onchainHistoryLoading, setOnchainHistoryLoading] = useState(false);
  const [onchainMsg, setOnchainMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const payment = useDecagonPayment();

  /* ── Wallet UI ── */
  const [showWallet, setShowWallet] = useState(false);
  const [copied, setCopied] = useState(false);

  /* ── Hydrate from localStorage ── */
  useEffect(() => {
    const session = getDemoSession();
    if (session) {
      setUser(session);
      setBalance(getBalance());
      setTransactions(getTransactions());
    }
    setHydrated(true);
  }, []);

  const refreshLedger = () => {
    setBalance(getBalance());
    setTransactions(getTransactions());
  };

  /* ──────────────────────── Auth ──────────────────────── */
  const handleSignIn = (method: "email" | "google") => {
    setAuthLoading(true);
    const email =
      method === "google" ? "demo.user@gmail.com" : authEmail.trim();
    if (!email) {
      setAuthLoading(false);
      return;
    }
    setTimeout(() => {
      const session = createDemoSession(email, method);
      setUser(session);
      setAuthEmail("");
      setAuthOpen(false);
      setAuthLoading(false);
      refreshLedger();
    }, 600);
  };

  const handleSignOut = () => {
    clearDemoSession();
    resetLedger();
    setUser(null);
    setBalance(0);
    setTransactions([]);
    setSendStep("idle");
    setSelectedContact(null);
    setShowAdvanced(false);
  };

  /* ──────────────────────── Top-up ──────────────────────── */
  const handleTopUp = (cents: number) => {
    topUp(cents);
    refreshLedger();
    setTopUpSuccess(true);
    setTimeout(() => {
      setTopUpSuccess(false);
      setTopUpOpen(false);
      setTopUpAmount("");
    }, 1200);
  };

  /* ──────────────────────── Send ──────────────────────── */
  const startSend = (contact?: DemoContact) => {
    setSendStep("contact");
    setSendAmount("");
    setSendNote("");
    setSendError(null);
    setLastTx(null);
    if (contact) {
      setSelectedContact(contact);
      setSendStep("amount");
    } else {
      setSelectedContact(null);
    }
  };

  const confirmSend = () => {
    if (!selectedContact) return;
    const cents = Math.round(parseFloat(sendAmount) * 100);
    if (isNaN(cents) || cents <= 0) {
      setSendError("Enter a valid amount");
      return;
    }
    const check = checkSpendPolicy(cents, DEMO_POLICY);
    if (!check.ok) {
      setSendError(check.reason ?? "Policy violation");
      return;
    }
    setSendError(null);
    setSendStep("confirm");
  };

  const executeSend = () => {
    if (!selectedContact) return;
    const cents = Math.round(parseFloat(sendAmount) * 100);
    const result = sendTransfer({
      amountCents: cents,
      recipientId: selectedContact.id,
      recipientName: selectedContact.name,
      note: sendNote || undefined,
    });
    if (typeof result === "string") {
      setSendError(result);
      setSendStep("amount");
      return;
    }
    setLastTx(result);
    setSendStep("success");
    refreshLedger();
  };

  const resetSend = () => {
    setSendStep("idle");
    setSelectedContact(null);
    setSendAmount("");
    setSendNote("");
    setSendError(null);
    setLastTx(null);
  };

  /* ──────────────────── On-chain (Advanced) ──────────────────── */
  const fetchOnchainHistory = useCallback(async () => {
    setOnchainHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/transfer/history`);
      if (res.ok) {
        const data = await res.json();
        setOnchainHistory(data.transfers ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setOnchainHistoryLoading(false);
    }
  }, []);

  const handleCreateTransfer = async () => {
    if (!recipientAddress) {
      setOnchainMsg({
        type: "error",
        text: "Please enter a recipient address",
      });
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      setOnchainMsg({ type: "error", text: "Invalid Ethereum address" });
      return;
    }
    setOnchainLoading(true);
    setOnchainMsg(null);
    try {
      const res = await fetch(`${API_BASE}/transfer/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientAddress,
          note: onchainNote || undefined,
        }),
      });
      const data = await res.json();
      if (data.challenge) {
        setChallenge(data.challenge);
        payment.open({
          challenge: data.challenge,
          config: {
            apiBase: API_BASE,
            plasmaChainId: PLASMA_CHAIN_ID,
            explorerTxBase: PLASMA_EXPLORER_TX_BASE,
          },
          purpose: onchainNote || "Remittance transfer",
          existingSessionTokenId: getStoredSessionTokenId(),
          onSuccess: handleTransferSuccess,
          onClose: () => setChallenge(null),
        });
      } else {
        setOnchainMsg({
          type: "error",
          text: data.message ?? "Failed to create transfer",
        });
      }
    } catch {
      setOnchainMsg({
        type: "error",
        text: "Network error. Is the API running?",
      });
    } finally {
      setOnchainLoading(false);
    }
  };

  const handleTransferSuccess = (
    _receipt: DecagonReceipt,
    sessionToken: unknown
  ) => {
    setChallenge(null);
    setOnchainMsg({ type: "success", text: "Transfer sent on-chain!" });
    setRecipientAddress("");
    setOnchainNote("");
    if (
      sessionToken &&
      typeof sessionToken === "object" &&
      "tokenId" in sessionToken
    ) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionToken));
    }
    fetchOnchainHistory();
  };

  /* ── Copy wallet ── */
  const copyWallet = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  /* ── Loading ── */
  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     LANDING VIEW (no session)
     ══════════════════════════════════════════════════════════ */
  if (!user) {
    return (
      <>
        {/* Hero */}
        <section className="relative overflow-hidden gradient-hero text-white">
          <div className="absolute inset-0 grid-pattern opacity-20" />
          <div className="relative mx-auto max-w-4xl px-4 sm:px-6 py-24 sm:py-32 text-center">
            <Badge
              variant="outline"
              className="mb-6 border-white/20 text-white/80 bg-white/5"
            >
              <Sparkles className="h-3 w-3 mr-1" /> Demo Mode
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6">
              Send Money
              <br />
              <span className="text-gradient">Anywhere, Instantly</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
              Experience Decagon&apos;s remittance flow — mock onboarding, demo
              wallet, instant transfers, and spend-policy enforcement. All
              powered by Plasma settlement under the hood.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="xl"
                className="gap-2 shadow-lg"
                onClick={() => setAuthOpen(true)}
              >
                Get Started <ArrowRight className="h-5 w-5" />
              </Button>
              <Button
                size="xl"
                variant="outline"
                className="gap-2 border-white/20 text-white hover:bg-white/10"
                onClick={() => {
                  const session = createDemoSession(
                    "advanced@decagon.demo",
                    "email"
                  );
                  setUser(session);
                  refreshLedger();
                  setShowAdvanced(true);
                }}
              >
                <Zap className="h-5 w-5" /> On-Chain Mode
              </Button>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-3 mt-12">
              {[
                { icon: Shield, label: "Spend Policy Enforced" },
                { icon: Globe, label: "Cross-Border Ready" },
                { icon: Zap, label: "Plasma Settlement" },
                { icon: Lock, label: "Demo Safe" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs text-white/80"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 py-20">
          <h2 className="text-2xl font-bold text-center mb-12">
            How the Demo Works
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Sign In",
                desc: "Enter any email — we generate a demo wallet and session instantly.",
              },
              {
                step: "2",
                title: "Top Up",
                desc: "Add demo funds with a fake card. No real money involved.",
              },
              {
                step: "3",
                title: "Send Money",
                desc: "Pick a contact, enter an amount, and the spend policy validates it in real time.",
              },
            ].map((s) => (
              <Card key={s.step} className="text-center gradient-card">
                <CardContent className="pt-8 pb-6">
                  <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
                    {s.step}
                  </div>
                  <h3 className="font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Auth Dialog */}
        <Dialog open={authOpen} onOpenChange={setAuthOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Welcome to Decagon Remit</DialogTitle>
              <DialogDescription>
                Sign in to start sending demo transfers. No real credentials
                needed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Google mock */}
              <Button
                variant="outline"
                className="w-full gap-2 h-11"
                onClick={() => handleSignIn("google")}
                disabled={authLoading}
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
                Continue with Google
              </Button>

              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                  or
                </span>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && authEmail && handleSignIn("email")
                  }
                />
                <Button
                  className="w-full gap-2"
                  onClick={() => handleSignIn("email")}
                  disabled={!authEmail.trim() || authLoading}
                >
                  {authLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  Continue with Email
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-center text-muted-foreground">
              ⚠️ This is a <strong>demo</strong>. No real account is created.
            </p>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  /* ══════════════════════════════════════════════════════════
     DASHBOARD VIEW (authenticated)
     ══════════════════════════════════════════════════════════ */
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 sm:py-12">
      {/* Demo banner */}
      <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mb-6 text-xs text-amber-700">
        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
        <span>
          <strong>Demo Mode</strong> — No real money. Balances and transfers are
          simulated.
        </span>
      </div>

      {/* User header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
            {user.avatarInitial}
          </div>
          <div>
            <p className="font-semibold text-sm">{user.displayName}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-1" /> Sign Out
        </Button>
      </div>

      {/* ── Balance Card ── */}
      <Card className="mb-6 overflow-hidden">
        <div className="gradient-primary p-6 text-white">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-white/80">
              Demo Balance
            </span>
            <Badge
              variant="outline"
              className="border-white/30 text-white/90 text-[10px]"
            >
              USD
            </Badge>
          </div>
          <p className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            ${(balance / 100).toFixed(2)}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5 bg-white/20 text-white hover:bg-white/30 border-0"
              onClick={() => {
                setTopUpSuccess(false);
                setTopUpAmount("");
                setTopUpOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Top Up
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5 bg-white/20 text-white hover:bg-white/30 border-0"
              onClick={() => startSend()}
            >
              <Send className="h-3.5 w-3.5" /> Send
            </Button>
          </div>
        </div>

        {/* Wallet address */}
        <CardContent className="py-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" />
            <span className="font-mono">
              {showWallet
                ? user.walletAddress
                : `${user.walletAddress.slice(0, 8)}••••••${user.walletAddress.slice(-4)}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="p-1 rounded hover:bg-muted transition-colors"
              onClick={() => setShowWallet(!showWallet)}
            >
              {showWallet ? (
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
            <button
              className="p-1 rounded hover:bg-muted transition-colors"
              onClick={copyWallet}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── Send Flow Card ── */}
      {sendStep !== "idle" && (
        <Card className="mb-6 animate-fade-in">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                {sendStep === "success" ? "Transfer Complete" : "Send Money"}
              </CardTitle>
              {sendStep !== "success" && (
                <Button variant="ghost" size="sm" onClick={resetSend}>
                  Cancel
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Select Contact */}
            {sendStep === "contact" && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">
                  Select a recipient
                </p>
                {DEMO_CONTACTS.map((c) => (
                  <button
                    key={c.id}
                    className="flex items-center gap-3 w-full rounded-lg border p-3 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => {
                      setSelectedContact(c);
                      setSendStep("amount");
                    }}
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-white text-sm font-semibold ${c.color}`}
                    >
                      {c.avatarInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {c.country} {c.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate font-mono">
                        {c.walletAddress.slice(0, 10)}…
                        {c.walletAddress.slice(-4)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            {/* Enter Amount */}
            {sendStep === "amount" && selectedContact && (
              <div className="space-y-4">
                {/* Recipient bar */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-white text-sm font-semibold ${selectedContact.color}`}
                  >
                    {selectedContact.avatarInitial}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {selectedContact.country} {selectedContact.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedContact.email}
                    </p>
                  </div>
                  <button
                    className="ml-auto text-xs text-primary hover:underline"
                    onClick={() => setSendStep("contact")}
                  >
                    Change
                  </button>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                    Amount (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={sendAmount}
                      onChange={(e) => {
                        setSendAmount(e.target.value);
                        setSendError(null);
                      }}
                      className="pl-7 text-lg font-semibold"
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Available: ${(balance / 100).toFixed(2)} · Max per
                    transfer: $
                    {(DEMO_POLICY.maxPerActionCents / 100).toFixed(2)}
                  </p>
                </div>

                {/* Note */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                    Note (optional)
                  </label>
                  <Input
                    placeholder="e.g. Rent, Gift, Invoice #123"
                    value={sendNote}
                    onChange={(e) => setSendNote(e.target.value)}
                  />
                </div>

                {sendError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {sendError}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSendStep("contact")}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                  <Button
                    className="flex-1 gap-1"
                    onClick={confirmSend}
                    disabled={!sendAmount}
                  >
                    Review <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Confirm */}
            {sendStep === "confirm" && selectedContact && (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">To</span>
                    <span className="font-medium">
                      {selectedContact.country} {selectedContact.name}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-bold text-lg">
                      ${parseFloat(sendAmount).toFixed(2)}
                    </span>
                  </div>
                  {sendNote && (
                    <>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Note</span>
                        <span className="text-right max-w-[60%]">
                          {sendNote}
                        </span>
                      </div>
                    </>
                  )}
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fee</span>
                    <span className="text-emerald-600 font-medium">Free</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5">
                  <Shield className="h-3.5 w-3.5 flex-shrink-0" />
                  Validated by Decagon spend policy
                </div>

                {sendError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {sendError}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSendStep("amount")}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button className="flex-1 gap-1" onClick={executeSend}>
                    <Send className="h-4 w-4" /> Confirm &amp; Send
                  </Button>
                </div>
              </div>
            )}

            {/* Success */}
            {sendStep === "success" && lastTx && (
              <div className="text-center py-4 space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">
                    ${(lastTx.amountCents / 100).toFixed(2)} sent
                  </p>
                  <p className="text-sm text-muted-foreground">
                    to {lastTx.recipientName}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Transaction ID</span>
                    <span className="font-mono">
                      {lastTx.id.slice(0, 16)}…
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status</span>
                    <Badge variant="success" className="text-[10px]">
                      Completed
                    </Badge>
                  </div>
                </div>
                <Button className="w-full" onClick={resetSend}>
                  Done
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Quick Send Contacts (when idle) ── */}
      {sendStep === "idle" && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Quick Send</h2>
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => startSend()}
            >
              View All
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {DEMO_CONTACTS.slice(0, 5).map((c) => (
              <button
                key={c.id}
                className="flex flex-col items-center gap-1.5 min-w-[64px] group"
                onClick={() => startSend(c)}
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-white text-sm font-semibold ring-2 ring-transparent group-hover:ring-primary/30 transition-all ${c.color}`}
                >
                  {c.avatarInitial}
                </div>
                <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors truncate max-w-[64px]">
                  {c.name.split(" ")[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Transaction History (when idle) ── */}
      {sendStep === "idle" && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-3">Recent Activity</h2>
          {transactions.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <Wallet className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No activity yet</p>
                <p className="text-xs mt-1">
                  Top up your demo balance, then send a transfer.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 15).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${
                      tx.type === "topup"
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    {tx.type === "topup" ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {tx.type === "topup"
                        ? "Demo Top-Up"
                        : `Sent to ${tx.recipientName}`}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(tx.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`font-semibold text-sm ${
                      tx.type === "topup"
                        ? "text-emerald-600"
                        : "text-foreground"
                    }`}
                  >
                    {tx.type === "topup" ? "+" : "−"}$
                    {(tx.amountCents / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Advanced On-Chain Section ── */}
      {sendStep === "idle" && (
        <>
          <Separator className="mb-6" />

          <button
            className="flex items-center justify-between w-full rounded-lg border p-4 hover:bg-muted/50 transition-colors mb-4"
            onClick={() => {
              setShowAdvanced(!showAdvanced);
              if (!showAdvanced && onchainHistory.length === 0) {
                fetchOnchainHistory();
              }
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Settings2 className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">
                  Advanced: On-Chain Transfer
                </p>
                <p className="text-xs text-muted-foreground">
                  Send real on-chain via Plasma testnet PaymentSheet
                </p>
              </div>
            </div>
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                showAdvanced ? "rotate-90" : ""
              }`}
            />
          </button>

          {showAdvanced && (
            <div className="animate-fade-in space-y-6 mb-8">
              {/* On-chain status */}
              {onchainMsg && (
                <div
                  className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
                    onchainMsg.type === "success"
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-200"
                      : "bg-red-500/10 text-red-600 border border-red-200"
                  }`}
                >
                  {onchainMsg.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  )}
                  {onchainMsg.text}
                </div>
              )}

              {/* On-chain form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    On-Chain Transfer
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                      Recipient Address
                    </label>
                    <Input
                      type="text"
                      placeholder="0x..."
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                      Note (optional)
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. Rent payment, Gift"
                      value={onchainNote}
                      onChange={(e) => setOnchainNote(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full gap-2"
                    onClick={handleCreateTransfer}
                    disabled={onchainLoading}
                  >
                    {onchainLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    {onchainLoading
                      ? "Creating transfer…"
                      : "Send via Plasma"}
                    {!onchainLoading && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </CardContent>
              </Card>

              {/* On-chain history */}
              <div>
                <h3 className="text-sm font-semibold mb-3">
                  On-Chain History
                </h3>
                {onchainHistoryLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : onchainHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No on-chain transfers yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {onchainHistory.map((tx) => (
                      <div
                        key={tx.receiptId}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <span className="text-sm font-medium font-mono">
                            To:{" "}
                            {(() => {
                              const addr =
                                tx.resourceId?.replace("transfer:", "") ?? "";
                              return addr
                                ? `${addr.slice(0, 6)}…${addr.slice(-4)}`
                                : "—";
                            })()}
                          </span>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {tx.verifiedAt
                              ? new Date(tx.verifiedAt).toLocaleString()
                              : "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="success" className="font-semibold">
                            ${((tx.amountPaid ?? 0) / 100).toFixed(2)}
                          </Badge>
                          {tx.txHash && (
                            <a
                              href={
                                tx.explorerUrl ||
                                `${PLASMA_EXPLORER_TX_BASE}${tx.txHash}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Top-Up Dialog ── */}
      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Demo Funds</DialogTitle>
            <DialogDescription>
              Top up your demo balance with a fake card. No real charge.
            </DialogDescription>
          </DialogHeader>

          {topUpSuccess ? (
            <div className="text-center py-6">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 mb-4">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <p className="font-semibold">Funds Added!</p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Fake card */}
              <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-4 text-white text-sm space-y-3">
                <div className="flex justify-between items-start">
                  <CreditCard className="h-6 w-6 text-white/60" />
                  <span className="text-xs text-white/50">DEMO CARD</span>
                </div>
                <p className="font-mono tracking-widest text-white/90 text-base">
                  4242 •••• •••• 4242
                </p>
                <div className="flex justify-between text-xs text-white/60">
                  <span>Demo User</span>
                  <span>12/99</span>
                </div>
              </div>

              {/* Quick amounts */}
              <div>
                <p className="text-sm font-medium mb-2">Quick Amount</p>
                <div className="grid grid-cols-4 gap-2">
                  {QUICK_AMOUNTS.map((cents) => (
                    <Button
                      key={cents}
                      variant="outline"
                      size="sm"
                      onClick={() => handleTopUp(cents)}
                    >
                      ${(cents / 100).toFixed(0)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom */}
              <div>
                <p className="text-sm font-medium mb-2">Custom Amount</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      placeholder="0"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      className="pl-7"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      const cents = Math.round(parseFloat(topUpAmount) * 100);
                      if (cents > 0) handleTopUp(cents);
                    }}
                    disabled={!topUpAmount || parseFloat(topUpAmount) <= 0}
                  >
                    Add
                  </Button>
                </div>
              </div>

              <p className="text-[11px] text-center text-muted-foreground">
                ⚠️ No real charge. This is a demo top-up.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── PaymentSheet (on-chain) ── */}
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
    </div>
  );
}
