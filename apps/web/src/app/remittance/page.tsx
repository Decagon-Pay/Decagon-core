"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  User,
} from "lucide-react";

import {
  getDemoSession,
  createDemoSession,
  updateDemoSession,
  clearDemoSession,
  type DemoUser,
  type DemoCard,
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

/* ── On-chain types (preserved) ── */
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

/* ── Constants ── */
const DEMO_POLICY = {
  maxPerActionCents: 50000,
  dailyCapCents: 200000,
};

const QUICK_AMOUNTS = [1000, 2500, 5000, 10000];

const COUNTRIES = [
  { code: "US", flag: "\u{1F1FA}\u{1F1F8}", name: "United States" },
  { code: "GB", flag: "\u{1F1EC}\u{1F1E7}", name: "United Kingdom" },
  { code: "CA", flag: "\u{1F1E8}\u{1F1E6}", name: "Canada" },
  { code: "MX", flag: "\u{1F1F2}\u{1F1FD}", name: "Mexico" },
  { code: "BR", flag: "\u{1F1E7}\u{1F1F7}", name: "Brazil" },
  { code: "NG", flag: "\u{1F1F3}\u{1F1EC}", name: "Nigeria" },
  { code: "GH", flag: "\u{1F1EC}\u{1F1ED}", name: "Ghana" },
  { code: "KE", flag: "\u{1F1F0}\u{1F1EA}", name: "Kenya" },
  { code: "IN", flag: "\u{1F1EE}\u{1F1F3}", name: "India" },
  { code: "PH", flag: "\u{1F1F5}\u{1F1ED}", name: "Philippines" },
  { code: "VN", flag: "\u{1F1FB}\u{1F1F3}", name: "Vietnam" },
  { code: "DE", flag: "\u{1F1E9}\u{1F1EA}", name: "Germany" },
  { code: "FR", flag: "\u{1F1EB}\u{1F1F7}", name: "France" },
  { code: "JP", flag: "\u{1F1EF}\u{1F1F5}", name: "Japan" },
  { code: "KR", flag: "\u{1F1F0}\u{1F1F7}", name: "South Korea" },
  { code: "AU", flag: "\u{1F1E6}\u{1F1FA}", name: "Australia" },
];

/* ── Helpers ── */
function formatCardNum(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 16);
  return d.replace(/(.{4})/g, "$1 ").trim();
}

function cardPreview(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 16).padEnd(16, "\u2022");
  return `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8, 12)} ${d.slice(12, 16)}`;
}

function formatExpiry(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 4);
  if (d.length >= 3) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

function detectBrand(num: string): string {
  const d = num.replace(/\D/g, "");
  if (d.startsWith("4")) return "Visa";
  if (d.startsWith("5")) return "Mastercard";
  if (d.startsWith("3")) return "Amex";
  return "Card";
}

/* ── Framer Motion variants ── */
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 240 : -240, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? 240 : -240, opacity: 0 }),
};

type OnboardingStep = "welcome" | "login" | "details" | "card" | "ready";

/* ═══════════════════════════════════════════════════════════
   RemittancePage: Premium Fintech Demo
   ═══════════════════════════════════════════════════════════ */

export default function RemittancePage() {
  /* ── Core state ── */
  const [user, setUser] = useState<DemoUser | null>(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<DemoTransaction[]>([]);
  const [hydrated, setHydrated] = useState(false);

  /* ── Onboarding ── */
  const [step, setStep] = useState<OnboardingStep | "dashboard">("welcome");
  const [direction, setDirection] = useState(1);

  /* Login */
  const [authEmail, setAuthEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  /* Details */
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [kycVerified, setKycVerified] = useState(false);
  const [kycLoading, setKycLoading] = useState(false);

  /* Card */
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardLoading, setCardLoading] = useState(false);

  /* ── Dashboard state ── */
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpSuccess, setTopUpSuccess] = useState(false);

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

  /* Advanced on-chain */
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

  /* Wallet UI */
  const [showWallet, setShowWallet] = useState(false);
  const [copied, setCopied] = useState(false);

  /* ── Hydrate from localStorage ── */
  useEffect(() => {
    const session = getDemoSession();
    if (session) {
      setUser(session);
      setBalance(getBalance());
      setTransactions(getTransactions());
      if (session.kycComplete) {
        setStep("dashboard");
      } else if (session.fullName) {
        setStep("card");
      } else {
        setStep("details");
      }
    }
    setHydrated(true);
  }, []);

  const refreshLedger = () => {
    setBalance(getBalance());
    setTransactions(getTransactions());
  };

  /* ── Navigation ── */
  const goForward = (next: OnboardingStep | "dashboard") => {
    setDirection(1);
    setStep(next);
  };

  const goBack = (prev: OnboardingStep) => {
    setDirection(-1);
    setStep(prev);
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
      setAuthLoading(false);
      refreshLedger();
      goForward("details");
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
    setStep("welcome");
    setDirection(1);
    setFullName("");
    setCountry("");
    setKycVerified(false);
    setCardNumber("");
    setCardExpiry("");
    setCardCvc("");
    setCardHolder("");
  };

  /* ──────────────────────── KYC ──────────────────────── */
  const handleVerifyKyc = () => {
    setKycLoading(true);
    setTimeout(() => {
      setKycVerified(true);
      setKycLoading(false);
    }, 1500);
  };

  const handleDetailsSubmit = () => {
    if (!fullName.trim() || !country) return;
    const updated = updateDemoSession({
      fullName: fullName.trim(),
      country,
      kycComplete: true,
      displayName: fullName.trim(),
    });
    if (updated) setUser(updated);
    setCardHolder(fullName.trim());
    goForward("card");
  };

  /* ──────────────────────── Card ──────────────────────── */
  const handleAddCard = () => {
    const digits = cardNumber.replace(/\D/g, "");
    if (digits.length < 15 || !cardExpiry || !cardCvc) return;
    setCardLoading(true);
    setTimeout(() => {
      const card: DemoCard = {
        last4: digits.slice(-4),
        brand: detectBrand(digits),
        expiry: formatExpiry(cardExpiry),
        holder: cardHolder || fullName || "Demo User",
      };
      const updated = updateDemoSession({ card });
      if (updated) setUser(updated);
      setCardLoading(false);
      goForward("ready");
    }, 1200);
  };

  const handleSkipCard = () => {
    goForward("ready");
  };

  const handleEnterDashboard = () => {
    refreshLedger();
    goForward("dashboard");
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

  /* ═══════════════════════════════════════════════════════
     ONBOARDING FLOW
     ═══════════════════════════════════════════════════════ */
  if (step !== "dashboard") {
    return (
      <div className="min-h-[calc(100vh-44px)] flex flex-col">
        <AnimatePresence mode="wait" custom={direction}>
          {/* ── Step 0: Welcome ───────────────────────── */}
          {step === "welcome" && (
            <motion.div
              key="welcome"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.3 }}
              className="flex-1"
            >
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
                    Experience Decagon&apos;s remittance flow: mock onboarding,
                    demo wallet, instant transfers, and spend-policy
                    enforcement, all powered by Plasma settlement.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button
                      size="xl"
                      className="gap-2 shadow-lg shadow-primary/25"
                      onClick={() => goForward("login")}
                    >
                      Get Started <ArrowRight className="h-5 w-5" />
                    </Button>
                    <Button
                      size="xl"
                      variant="outline"
                      className="gap-2 border-white/25 text-white hover:bg-white/10 bg-transparent"
                      onClick={() => {
                        const session = createDemoSession(
                          "advanced@decagon.demo",
                          "email"
                        );
                        updateDemoSession({
                          kycComplete: true,
                          fullName: "Advanced User",
                          country: "US",
                        });
                        setUser({
                          ...session,
                          kycComplete: true,
                          fullName: "Advanced User",
                          country: "US",
                        });
                        refreshLedger();
                        setShowAdvanced(true);
                        goForward("dashboard");
                      }}
                    >
                      <Zap className="h-5 w-5" /> On-Chain Mode
                    </Button>
                  </div>

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

              <section className="mx-auto max-w-4xl px-4 sm:px-6 py-20">
                <h2 className="text-2xl font-bold text-center mb-12">
                  How the Demo Works
                </h2>
                <div className="grid sm:grid-cols-4 gap-6">
                  {[
                    {
                      n: "1",
                      title: "Create Account",
                      desc: "Enter an email or sign in with Google. We generate your demo wallet instantly.",
                    },
                    {
                      n: "2",
                      title: "Verify Identity",
                      desc: "Complete a quick mock KYC check. No real documents required.",
                    },
                    {
                      n: "3",
                      title: "Add a Card",
                      desc: "Link a demo payment card for instant top-ups. Skip if you prefer.",
                    },
                    {
                      n: "4",
                      title: "Send Money",
                      desc: "Pick a contact, enter an amount, and the spend policy validates it live.",
                    },
                  ].map((s) => (
                    <Card key={s.n} className="text-center gradient-card">
                      <CardContent className="pt-8 pb-6">
                        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
                          {s.n}
                        </div>
                        <h3 className="font-semibold mb-2">{s.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {s.desc}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            </motion.div>
          )}

          {/* ── Step 1: Login ─────────────────────────── */}
          {step === "login" && (
            <motion.div
              key="login"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.3 }}
              className="flex-1 flex items-center justify-center px-4 py-16"
            >
              <div className="w-full max-w-md space-y-6">
                <button
                  onClick={() => goBack("welcome")}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>

                <div className="text-center mb-2">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    Create Your Account
                  </h1>
                  <p className="text-sm text-muted-foreground mt-2">
                    Sign in to start sending demo transfers. No real credentials
                    needed.
                  </p>
                </div>

                <Card>
                  <CardContent className="pt-6 space-y-4">
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

                    <div className="space-y-2">
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          authEmail &&
                          handleSignIn("email")
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
                  </CardContent>
                </Card>

                {/* Progress */}
                <div className="flex justify-center gap-1.5">
                  <div className="h-1.5 w-8 rounded-full bg-primary" />
                  <div className="h-1.5 w-8 rounded-full bg-muted" />
                  <div className="h-1.5 w-8 rounded-full bg-muted" />
                  <div className="h-1.5 w-8 rounded-full bg-muted" />
                </div>

                <p className="text-[11px] text-center text-muted-foreground">
                  This is a <strong>demo</strong>. No real account is created.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Details + KYC ─────────────────── */}
          {step === "details" && (
            <motion.div
              key="details"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.3 }}
              className="flex-1 flex items-center justify-center px-4 py-16"
            >
              <div className="w-full max-w-md space-y-6">
                <button
                  onClick={() => goBack("login")}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>

                <div className="text-center mb-2">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    Complete Your Profile
                  </h1>
                  <p className="text-sm text-muted-foreground mt-2">
                    Tell us a bit about yourself and verify your identity.
                  </p>
                </div>

                <Card>
                  <CardContent className="pt-6 space-y-5">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Full Name
                      </label>
                      <Input
                        placeholder="Jane Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Country of Residence
                      </label>
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="">Select a country</option>
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Separator />

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Identity Verification
                      </label>
                      {kycVerified ? (
                        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                          <span className="font-medium">
                            Identity verified
                          </span>
                          <Badge
                            variant="success"
                            className="ml-auto text-[10px]"
                          >
                            Passed
                          </Badge>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full gap-2 h-11"
                          onClick={handleVerifyKyc}
                          disabled={kycLoading}
                        >
                          {kycLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            <>
                              <Shield className="h-4 w-4" />
                              Verify Identity (Mock)
                            </>
                          )}
                        </Button>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Simulated KYC check. Completes in a few seconds.
                      </p>
                    </div>

                    <Button
                      className="w-full gap-2"
                      onClick={handleDetailsSubmit}
                      disabled={!fullName.trim() || !country || !kycVerified}
                    >
                      Continue <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>

                <div className="flex justify-center gap-1.5">
                  <div className="h-1.5 w-8 rounded-full bg-primary" />
                  <div className="h-1.5 w-8 rounded-full bg-primary" />
                  <div className="h-1.5 w-8 rounded-full bg-muted" />
                  <div className="h-1.5 w-8 rounded-full bg-muted" />
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Card ──────────────────────────── */}
          {step === "card" && (
            <motion.div
              key="card"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.3 }}
              className="flex-1 flex items-center justify-center px-4 py-16"
            >
              <div className="w-full max-w-md space-y-6">
                <button
                  onClick={() => goBack("details")}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>

                <div className="text-center mb-2">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <CreditCard className="h-6 w-6 text-primary" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    Add a Payment Method
                  </h1>
                  <p className="text-sm text-muted-foreground mt-2">
                    Link a card for instant top-ups, or skip for now.
                  </p>
                </div>

                {/* Live card preview */}
                <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 text-white space-y-4 shadow-xl">
                  <div className="flex justify-between items-start">
                    <CreditCard className="h-7 w-7 text-white/60" />
                    <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
                      {cardNumber ? detectBrand(cardNumber) : "Card"}
                    </span>
                  </div>
                  <p className="font-mono tracking-[0.2em] text-white/90 text-lg">
                    {cardPreview(cardNumber)}
                  </p>
                  <div className="flex justify-between text-xs text-white/60">
                    <span className="uppercase">
                      {cardHolder || "YOUR NAME"}
                    </span>
                    <span>
                      {cardExpiry ? formatExpiry(cardExpiry) : "MM/YY"}
                    </span>
                  </div>
                </div>

                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Card Number
                      </label>
                      <Input
                        placeholder="4242 4242 4242 4242"
                        value={formatCardNum(cardNumber)}
                        onChange={(e) =>
                          setCardNumber(
                            e.target.value.replace(/\D/g, "").slice(0, 16)
                          )
                        }
                        className="font-mono tracking-wider"
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">
                          Expiry
                        </label>
                        <Input
                          placeholder="MM/YY"
                          value={formatExpiry(cardExpiry)}
                          onChange={(e) =>
                            setCardExpiry(
                              e.target.value.replace(/\D/g, "").slice(0, 4)
                            )
                          }
                          className="font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">
                          CVC
                        </label>
                        <Input
                          placeholder="123"
                          value={cardCvc}
                          onChange={(e) =>
                            setCardCvc(
                              e.target.value.replace(/\D/g, "").slice(0, 4)
                            )
                          }
                          type="password"
                          className="font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Cardholder Name
                      </label>
                      <Input
                        placeholder="Jane Doe"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                      />
                    </div>

                    <Button
                      className="w-full gap-2"
                      onClick={handleAddCard}
                      disabled={
                        cardNumber.replace(/\D/g, "").length < 15 ||
                        !cardExpiry ||
                        !cardCvc ||
                        cardLoading
                      }
                    >
                      {cardLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4" /> Add Card
                        </>
                      )}
                    </Button>

                    <button
                      className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                      onClick={handleSkipCard}
                    >
                      Skip for now
                    </button>
                  </CardContent>
                </Card>

                <div className="flex justify-center gap-1.5">
                  <div className="h-1.5 w-8 rounded-full bg-primary" />
                  <div className="h-1.5 w-8 rounded-full bg-primary" />
                  <div className="h-1.5 w-8 rounded-full bg-primary" />
                  <div className="h-1.5 w-8 rounded-full bg-muted" />
                </div>

                <p className="text-[11px] text-center text-muted-foreground">
                  This is a demo card. No real charge will be made.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Step 4: Wallet Ready ──────────────────── */}
          {step === "ready" && user && (
            <motion.div
              key="ready"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.3 }}
              className="flex-1 flex items-center justify-center px-4 py-16"
            >
              <div className="w-full max-w-md text-center space-y-8">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", delay: 0.1, bounce: 0.5 }}
                >
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 mb-6">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                  </div>
                </motion.div>

                <div>
                  <h1 className="text-2xl font-bold tracking-tight mb-2">
                    Your Wallet is Ready
                  </h1>
                  <p className="text-muted-foreground">
                    Welcome, {user.fullName || user.displayName}. Your demo
                    wallet has been created and is ready to use.
                  </p>
                </div>

                <Card>
                  <CardContent className="pt-6 pb-5 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Wallet className="h-4 w-4 text-primary" />
                      Wallet Address
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                      <code className="flex-1 text-xs font-mono break-all text-left">
                        {user.walletAddress}
                      </code>
                      <button
                        className="p-1.5 rounded-md hover:bg-background transition-colors flex-shrink-0"
                        onClick={copyWallet}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                    {user.card && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CreditCard className="h-3.5 w-3.5" />
                        {user.card.brand} ending in {user.card.last4}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Button
                  size="xl"
                  className="w-full gap-2 shadow-lg shadow-primary/25"
                  onClick={handleEnterDashboard}
                >
                  Go to Dashboard <ArrowRight className="h-5 w-5" />
                </Button>

                <div className="flex justify-center gap-1.5">
                  <div className="h-1.5 w-8 rounded-full bg-primary" />
                  <div className="h-1.5 w-8 rounded-full bg-primary" />
                  <div className="h-1.5 w-8 rounded-full bg-primary" />
                  <div className="h-1.5 w-8 rounded-full bg-primary" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     DASHBOARD VIEW
     ═══════════════════════════════════════════════════════ */
  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 sm:py-12">
      {/* Demo banner */}
      <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mb-6 text-xs text-amber-700">
        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
        <span>
          <strong>Demo Mode</strong> &middot; No real money. Balances and
          transfers are simulated.
        </span>
      </div>

      {/* User header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
            {user.avatarInitial}
          </div>
          <div>
            <p className="font-semibold text-sm">
              {user.fullName || user.displayName}
            </p>
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

        <CardContent className="py-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" />
            <span className="font-mono">
              {showWallet
                ? user.walletAddress
                : `${user.walletAddress.slice(0, 8)}\u2022\u2022\u2022\u2022\u2022\u2022${user.walletAddress.slice(-4)}`}
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
                        {c.walletAddress.slice(0, 10)}...
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
                    Available: ${(balance / 100).toFixed(2)} · Max per transfer:
                    ${(DEMO_POLICY.maxPerActionCents / 100).toFixed(2)}
                  </p>
                </div>

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
                      {lastTx.id.slice(0, 16)}...
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

      {/* ── Quick Send Contacts ── */}
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
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {DEMO_CONTACTS.map((c) => (
              <button
                key={c.id}
                className="flex flex-col items-center gap-2 rounded-xl border p-3 hover:bg-muted/50 hover:border-primary/20 transition-all group"
                onClick={() => startSend(c)}
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-white text-sm font-semibold ring-2 ring-transparent group-hover:ring-primary/30 transition-all ${c.color}`}
                >
                  {c.avatarInitial}
                </div>
                <div className="text-center min-w-0 w-full">
                  <p className="text-xs font-medium truncate">
                    {c.name.split(" ")[0]}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.country}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Transaction History ── */}
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
                    {tx.type === "topup" ? "+" : "\u2212"}$
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
                      ? "Creating transfer..."
                      : "Send via Plasma"}
                    {!onchainLoading && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </CardContent>
              </Card>

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
                                ? `${addr.slice(0, 6)}...${addr.slice(-4)}`
                                : "-";
                            })()}
                          </span>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {tx.verifiedAt
                              ? new Date(tx.verifiedAt).toLocaleString()
                              : "-"}
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
              Top up your demo balance. No real charge.
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
              {/* Card display */}
              <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-4 text-white text-sm space-y-3">
                <div className="flex justify-between items-start">
                  <CreditCard className="h-6 w-6 text-white/60" />
                  <span className="text-xs text-white/50">
                    {user.card
                      ? user.card.brand.toUpperCase()
                      : "DEMO CARD"}
                  </span>
                </div>
                <p className="font-mono tracking-widest text-white/90 text-base">
                  {user.card
                    ? `\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ${user.card.last4}`
                    : "4242 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 4242"}
                </p>
                <div className="flex justify-between text-xs text-white/60">
                  <span>
                    {user.card?.holder || user.fullName || "Demo User"}
                  </span>
                  <span>{user.card?.expiry || "12/99"}</span>
                </div>
              </div>

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
                No real charge. This is a demo top-up.
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
