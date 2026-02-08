"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PaymentSheet } from "@decagon/ui";
import type { DecagonReceipt } from "@decagon/ui";
import { API_BASE, PLASMA_CHAIN_ID, PLASMA_EXPLORER_TX_BASE } from "@/lib/config";

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
  acceptedPaymentMethods: Array<{ type: string; name: string; available: boolean }>;
}

interface Receipt {
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

// Helpers
const SESSION_KEY = "decagon_session_token";

function formatPrice(price: number, currency: string): string {
  if (currency === "USD" || currency === "USDT") {
    return `$${(price / 100).toFixed(2)}`;
  }
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
      // Check if expired
      if (new Date(session.expiresAt) > new Date()) {
        return session;
      }
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

export default function ArticlePage() {
  const params = useParams();
  const articleId = params.id as string;

  const [article, setArticle] = useState<Article | null>(null);
  const [content, setContent] = useState<string>("");
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [challenge, setChallenge] = useState<PaymentChallenge | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [sessionToken, setSessionToken] = useState<SessionToken | null>(null);
  const [credits, setCredits] = useState<number>(0);

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = getStoredSession();
    if (stored) {
      setSessionToken(stored);
      setCredits(stored.credits);
    }
  }, []);

  // Fetch article
  const fetchArticle = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      const stored = getStoredSession();
      if (stored) {
        headers["Authorization"] = `Bearer ${stored.tokenId}`;
      }

      const res = await fetch(`${API_BASE}/article/${articleId}`, { headers });
      
      if (res.status === 402) {
        // Payment required - parse challenge
        const data: PaymentRequiredResponse = await res.json();
        setChallenge(data.challenge);
        setHasFullAccess(false);
        // Get article info from somewhere else (list endpoint)
        const articlesRes = await fetch(`${API_BASE}/articles`);
        if (articlesRes.ok) {
          const articlesData = await articlesRes.json();
          const found = articlesData.articles.find((a: ArticleResponse) => a.article.id === articleId);
          if (found) {
            setArticle(found.article);
            setContent(found.content);
          }
        }
      } else if (res.ok) {
        // Full access granted
        const data: ArticleResponse = await res.json();
        setArticle(data.article);
        setContent(data.content);
        setHasFullAccess(data.hasFullAccess);
        // Update credits from balance endpoint
        if (stored) {
          try {
            const balanceRes = await fetch(`${API_BASE}/credits/balance`, {
              headers: { Authorization: `Bearer ${stored.tokenId}` },
            });
            if (balanceRes.ok) {
              const balanceData = await balanceRes.json();
              setCredits(balanceData.credits);
              // Update stored session
              const updatedSession = { ...stored, credits: balanceData.credits };
              storeSession(updatedSession);
              setSessionToken(updatedSession);
            }
          } catch {
            // Ignore balance fetch errors
          }
        }
      } else {
        // Other error
        console.error("Failed to fetch article");
      }
    } catch (e) {
      console.error("API error:", e);
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  const handleUnlock = () => {
    setShowPaymentSheet(true);
  };

  const handlePaymentSuccess = (receiptData: DecagonReceipt, sessionData: unknown) => {
    const newReceipt = receiptData as unknown as Receipt;
    const newSession = sessionData as SessionToken;
    setReceipt(newReceipt);
    setSessionToken(newSession);
    setCredits(newSession.credits);
    storeSession(newSession);
    setShowPaymentSheet(false);
    // Refetch article with new session
    setLoading(true);
    fetchArticle();
  };

  if (loading) {
    return (
      <main className="container article-page">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </main>
    );
  }

  if (!article) {
    return (
      <main className="container article-page">
        <Link href="/" className="back-link">
          ← Back to Marketplace
        </Link>
        <h1>Article Not Found</h1>
        <p>The article you&apos;re looking for doesn&apos;t exist.</p>
      </main>
    );
  }

  return (
    <main className="container article-page">
      <Link href="/" className="back-link">
        ← Back to Marketplace
      </Link>

      {/* Credits Badge */}
      {sessionToken && (
        <div style={{ 
          position: "fixed", 
          top: "1rem", 
          right: "1rem", 
          background: "var(--card-bg)", 
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "0.5rem 1rem",
          zIndex: 100,
        }}>
          <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>Credits: </span>
          <span style={{ color: "var(--primary)", fontWeight: 600 }}>{credits}</span>
        </div>
      )}

      <div className="article-header">
        <h1>{article.title}</h1>
        <div className="article-meta">
          <span>{article.author}</span>
          <span>•</span>
          <span>{article.readTimeMinutes} min read</span>
          <span>•</span>
          <span>{formatDate(article.publishedAt)}</span>
        </div>
        <div className="tags" style={{ marginTop: "1rem" }}>
          {article.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="article-content">
        {/* Content - full or preview based on access */}
        {hasFullAccess ? (
          <>
            <p style={{ color: "var(--success)", fontWeight: 600, marginBottom: "1rem" }}>
              ✓ Premium Content Unlocked (1 credit consumed)
            </p>
            <div style={{ whiteSpace: "pre-wrap" }}>{content}</div>
          </>
        ) : (
          <>
            <p>{content || article.preview}</p>
            <div className="premium-blur">
              <p className="premium-overlay">
                {article.premiumContent?.slice(0, 200) || "Premium content available after payment..."}...
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
                Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Unlock Section - show when no full access and have a challenge */}
      {!hasFullAccess && challenge && (
        <div className="unlock-section">
          <h3>🔒 Premium Content</h3>
          <p>
            HTTP 402 - Payment Required
          </p>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
            Top up {challenge.creditsOffered} credits for {formatPrice(challenge.amountRequired, challenge.currency)}
          </p>
          <button className="btn btn-primary" onClick={handleUnlock}>
            Unlock Now
          </button>
        </div>
      )}

      {/* Receipt Panel */}
      {receipt && (
        <div className="receipt-panel">
          <h3>🧾 Payment Receipt</h3>
          <div className="receipt-item">
            <span className="receipt-label">Receipt ID</span>
            <span className="receipt-value">{receipt.receiptId}</span>
          </div>
          <div className="receipt-item">
            <span className="receipt-label">Amount Paid</span>
            <span className="receipt-value">{formatPrice(receipt.amountPaid, receipt.currency)}</span>
          </div>
          <div className="receipt-item">
            <span className="receipt-label">Credits Purchased</span>
            <span className="receipt-value">{receipt.creditsPurchased}</span>
          </div>
          <div className="receipt-item">
            <span className="receipt-label">Transaction</span>
            <span className="receipt-value" style={{ fontSize: "0.75rem" }}>
              {receipt.transactionRef}
            </span>
          </div>
          <div className="receipt-item">
            <span className="receipt-label">Verified At</span>
            <span className="receipt-value">
              {new Date(receipt.verifiedAt).toLocaleString()}
            </span>
          </div>
          {sessionToken && (
            <div className="receipt-item">
              <span className="receipt-label">Current Credits</span>
              <span className="receipt-value" style={{ color: "var(--primary)" }}>
                {credits}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Decagon Payment Sheet */}
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
    </main>
  );
}
