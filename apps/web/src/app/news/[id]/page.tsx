"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PaymentSheet } from "@decagon/ui";
import type { DecagonReceipt } from "@decagon/ui";
import {
  API_BASE,
  PLASMA_CHAIN_ID,
  PLASMA_EXPLORER_TX_BASE,
} from "@/lib/config";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Clock,
  User,
  Lock,
  Unlock,
  CreditCard,
  Receipt as ReceiptIcon,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Coins,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────── */

interface Article {
  id: string;
  title: string;
  author: string;
  preview: string;
  premiumContent: string;
  price: number;
  currency: string;
  publishedAt: string;
  readTimeMinutes: number;
  tags: string[];
}

interface ArticleResponse {
  article: Article;
  hasFullAccess: boolean;
  content: string;
}

interface PaymentChallenge {
  challengeId: string;
  resourceId: string;
  amountRequired: number;
  currency: string;
  chain: string;
  description: string;
  payTo: string;
  expiresAt: string;
  createdAt: string;
  creditsOffered: number;
  status: string;
  chainId: number;
  assetType: "NATIVE" | "ERC20";
  assetSymbol: string;
  amountWei: string;
  payeeAddress: string;
  explorerTxBase: string;
}

interface PaymentRequiredResponse {
  status: number;
  message: string;
  challenge: PaymentChallenge;
  acceptedPaymentMethods: Array<{
    type: string;
    name: string;
    available: boolean;
  }>;
}

interface ReceiptData {
  receiptId: string;
  challengeId: string;
  resourceId: string;
  amountPaid: number;
  currency: string;
  transactionRef: string;
  verifiedAt: string;
  expiresAt: string;
  creditsPurchased: number;
  status: string;
}

interface SessionToken {
  tokenId: string;
  credits: number;
  currency: string;
  createdAt: string;
  expiresAt: string;
  accessCount: number;
}

/* ─── Helpers ───────────────────────────────────────── */

const SESSION_KEY = "decagon_session_token";

function formatPrice(price: number, currency: string): string {
  if (currency === "USD" || currency === "USDT")
    return `$${(price / 100).toFixed(2)}`;
  return `${price} ${currency}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getStoredSession(): SessionToken | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      const session = JSON.parse(stored) as SessionToken;
      if (new Date(session.expiresAt) > new Date()) return session;
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    localStorage.removeItem(SESSION_KEY);
  }
  return null;
}

function storeSession(session: SessionToken): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/* ─── Page ──────────────────────────────────────────── */

export default function NewsArticlePage() {
  const params = useParams();
  const articleId = params.id as string;

  const [article, setArticle] = useState<Article | null>(null);
  const [content, setContent] = useState<string>("");
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [challenge, setChallenge] = useState<PaymentChallenge | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [sessionToken, setSessionToken] = useState<SessionToken | null>(null);
  const [credits, setCredits] = useState<number>(0);

  useEffect(() => {
    const stored = getStoredSession();
    if (stored) {
      setSessionToken(stored);
      setCredits(stored.credits);
    }
  }, []);

  const fetchArticle = useCallback(
    async (sessionOverride?: SessionToken) => {
      try {
        const headers: Record<string, string> = {};
        const session = sessionOverride ?? getStoredSession();
        if (session) headers["Authorization"] = `Bearer ${session.tokenId}`;

        const res = await fetch(`${API_BASE}/article/${articleId}`, {
          headers,
        });

        if (res.status === 402) {
          const data: PaymentRequiredResponse = await res.json();
          setChallenge(data.challenge);
          setHasFullAccess(false);
          // Fetch article metadata from list
          const articlesRes = await fetch(`${API_BASE}/articles`);
          if (articlesRes.ok) {
            const articlesData = await articlesRes.json();
            const found = articlesData.articles.find(
              (a: ArticleResponse) => a.article.id === articleId
            );
            if (found) {
              setArticle(found.article);
              setContent(found.content);
            }
          }
        } else if (res.ok) {
          const data: ArticleResponse = await res.json();
          setArticle(data.article);
          setContent(data.content);
          setHasFullAccess(data.hasFullAccess);
          if (session) {
            try {
              const balanceRes = await fetch(`${API_BASE}/credits/balance`, {
                headers: { Authorization: `Bearer ${session.tokenId}` },
              });
              if (balanceRes.ok) {
                const balanceData = await balanceRes.json();
                setCredits(balanceData.credits);
                const updated = { ...session, credits: balanceData.credits };
                storeSession(updated);
                setSessionToken(updated);
              }
            } catch {
              /* ignore */
            }
          }
        }
      } catch (e) {
        console.error("API error:", e);
      } finally {
        setLoading(false);
      }
    },
    [articleId]
  );

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  const handlePaymentSuccess = (
    receiptData: DecagonReceipt,
    sessionData: unknown
  ) => {
    const newReceipt = receiptData as unknown as ReceiptData;
    const newSession = sessionData as SessionToken;
    setReceipt(newReceipt);
    setSessionToken(newSession);
    setCredits(newSession.credits);
    storeSession(newSession);
    setShowPaymentSheet(false);
    setLoading(true);
    fetchArticle(newSession);
  };

  /* ─── Loading state ─── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ─── 404 ─── */
  if (!article) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Article Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The article you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link href="/news">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to articles
          </Button>
        </Link>
      </div>
    );
  }

  /* ─── Render ─── */
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      {/* Credits badge — fixed top right */}
      {sessionToken && (
        <div className="fixed top-20 right-4 z-50">
          <Badge variant="outline" className="gap-1.5 bg-background shadow-md px-3 py-1.5">
            <Coins className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-primary">{credits}</span>
            <span className="text-muted-foreground text-xs">credits</span>
          </Badge>
        </div>
      )}

      {/* Back */}
      <Link
        href="/news"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 no-underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to articles
      </Link>

      {/* Article header */}
      <header className="mb-8">
        <div className="flex flex-wrap gap-2 mb-4">
          {article.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 leading-tight">
          {article.title}
        </h1>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <User className="h-4 w-4" />
            {article.author}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {article.readTimeMinutes} min read
          </span>
          <span>{formatDate(article.publishedAt)}</span>
        </div>
      </header>

      <Separator className="mb-8" />

      {/* Article body */}
      <article className="prose prose-slate max-w-none">
        {hasFullAccess ? (
          <>
            <div className="flex items-center gap-2 mb-6 text-sm">
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Premium Content Unlocked
              </Badge>
              <span className="text-muted-foreground">1 credit consumed</span>
            </div>
            <div className="text-foreground leading-relaxed whitespace-pre-wrap text-[0.95rem]">
              {content}
            </div>
          </>
        ) : (
          <>
            <p className="text-foreground leading-relaxed text-[0.95rem]">
              {content || article.preview}
            </p>

            {/* Blurred premium preview */}
            <div className="relative mt-6">
              <div className="premium-blur">
                <p className="text-foreground leading-relaxed text-[0.95rem]">
                  {article.premiumContent?.slice(0, 300) ||
                    "Premium content available after payment..."}
                  … Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
                  do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                  Ut enim ad minim veniam, quis nostrud exercitation ullamco
                  laboris nisi ut aliquip ex ea commodo consequat.
                </p>
              </div>
            </div>
          </>
        )}
      </article>

      {/* Unlock CTA */}
      {!hasFullAccess && challenge && (
        <Card className="mt-10 border-primary/20 bg-primary/[0.03]">
          <CardContent className="p-6 sm:p-8 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Premium Content</h3>
            <p className="text-sm text-muted-foreground mb-1">
              HTTP 402 — Payment Required
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Top up{" "}
              <span className="font-semibold text-foreground">
                {challenge.creditsOffered} credits
              </span>{" "}
              for{" "}
              <span className="font-semibold text-foreground">
                {formatPrice(challenge.amountRequired, challenge.currency)}
              </span>
            </p>
            <Button
              size="lg"
              className="gap-2"
              onClick={() => setShowPaymentSheet(true)}
            >
              <Unlock className="h-4 w-4" />
              Unlock Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Receipt */}
      {receipt && (
        <Card className="mt-8 border-emerald-200 dark:border-emerald-900">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <ReceiptIcon className="h-5 w-5 text-emerald-600" />
              <h3 className="font-semibold">Payment Receipt</h3>
            </div>
            <div className="grid gap-3 text-sm">
              {[
                { label: "Receipt ID", value: receipt.receiptId },
                {
                  label: "Amount Paid",
                  value: formatPrice(receipt.amountPaid, receipt.currency),
                },
                {
                  label: "Credits Purchased",
                  value: String(receipt.creditsPurchased),
                },
                {
                  label: "Verified At",
                  value: new Date(receipt.verifiedAt).toLocaleString(),
                },
              ].map((row) => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium text-right max-w-[60%] truncate">
                    {row.value}
                  </span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Transaction</span>
                <span className="font-mono text-xs max-w-[60%] truncate">
                  {receipt.transactionRef}
                </span>
              </div>
              {sessionToken && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">
                    Current Credits
                  </span>
                  <Badge variant="success" className="gap-1">
                    <Coins className="h-3 w-3" />
                    {credits}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Sheet */}
      {showPaymentSheet && challenge && (
        <PaymentSheet
          challenge={challenge}
          config={{
            apiBase: API_BASE,
            plasmaChainId: PLASMA_CHAIN_ID,
            explorerTxBase: PLASMA_EXPLORER_TX_BASE,
          }}
          onClose={() => setShowPaymentSheet(false)}
          onSuccess={handlePaymentSuccess}
          existingSessionTokenId={sessionToken?.tokenId}
        />
      )}
    </div>
  );
}
