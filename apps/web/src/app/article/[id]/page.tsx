"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

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
  description: string;
  payTo: string;
  expiresAt: string;
  createdAt: string;
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
}

interface SessionToken {
  tokenId: string;
  balance: number;
  currency: string;
  createdAt: string;
  expiresAt: string;
  accessCount: number;
}

// Mock article data for fallback
const MOCK_ARTICLES: Record<string, Article> = {
  "article-1": {
    id: "article-1",
    title: "The Future of Web Monetization",
    author: "Sarah Chen",
    preview: "Web monetization has long been dominated by advertising and subscriptions. But what if there was a better way? In this article, we explore how micro-payments could transform the internet economy...",
    premiumContent: "The complete guide to implementing micro-payments on your platform. This includes detailed technical specifications, case studies from early adopters, and a step-by-step implementation guide. We'll cover the HTTP 402 protocol, stablecoin integration, and user experience best practices that maximize conversion while minimizing friction.",
    price: 50,
    currency: "USD",
    publishedAt: "2026-01-15T10:00:00Z",
    readTimeMinutes: 8,
    tags: ["web3", "payments", "monetization"],
  },
  "article-2": {
    id: "article-2",
    title: "HTTP 402: The Forgotten Status Code",
    author: "Marcus Williams",
    preview: "When HTTP status codes were designed, 402 was reserved for 'Payment Required' - but it was never properly defined. Decades later, we finally have the technology to make it useful...",
    premiumContent: "A deep dive into the history of HTTP 402, from its origins in RFC 2616 to modern implementations. We examine how stablecoins and smart contracts enable trustless payments that the original designers could only dream of. Includes code examples in TypeScript, Go, and Rust.",
    price: 75,
    currency: "USD",
    publishedAt: "2026-01-20T14:30:00Z",
    readTimeMinutes: 12,
    tags: ["http", "protocol", "history"],
  },
  "article-3": {
    id: "article-3",
    title: "Building AI Agents That Can Pay",
    author: "Aisha Patel",
    preview: "AI agents are becoming increasingly autonomous. Soon, they'll need to access paid resources without human intervention. How do we build payment systems for machines?...",
    premiumContent: "Technical architecture for AI agent payment systems. This covers wallet management, spending limits, audit trails, and safety mechanisms. We present a complete TypeScript implementation that integrates with popular AI frameworks like LangChain and AutoGPT.",
    price: 100,
    currency: "USD",
    publishedAt: "2026-02-01T09:00:00Z",
    readTimeMinutes: 15,
    tags: ["ai", "agents", "automation"],
  },
  "article-4": {
    id: "article-4",
    title: "Stablecoins for Everyday Payments",
    author: "David Kim",
    preview: "Cryptocurrency volatility has long been a barrier to adoption. Stablecoins offer a solution, but how do they work in practice for small, everyday transactions?...",
    premiumContent: "A practical guide to integrating stablecoins into your payment flow. We cover Plasma, USDC, and other major stablecoins, comparing their fees, settlement times, and developer experience. Includes integration examples for e-commerce, content platforms, and API services.",
    price: 60,
    currency: "USD",
    publishedAt: "2026-02-03T11:00:00Z",
    readTimeMinutes: 10,
    tags: ["stablecoins", "crypto", "payments"],
  },
  "article-5": {
    id: "article-5",
    title: "The End of Subscription Fatigue",
    author: "Elena Rodriguez",
    preview: "The average consumer now has 12 active subscriptions. Is there a breaking point? Pay-per-use models offer an alternative that benefits both creators and consumers...",
    premiumContent: "Research and analysis on subscription economics versus pay-per-use models. We present data from 50,000 users comparing engagement, satisfaction, and lifetime value across different monetization strategies. Includes a framework for deciding which model fits your content.",
    price: 80,
    currency: "USD",
    publishedAt: "2026-02-05T16:00:00Z",
    readTimeMinutes: 11,
    tags: ["subscriptions", "economics", "ux"],
  },
};

function formatPrice(price: number, currency: string): string {
  if (currency === "USD") {
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

export default function ArticlePage() {
  const params = useParams();
  const articleId = params.id as string;

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState<any>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [paymentState, setPaymentState] = useState<"idle" | "challenge" | "paid">("idle");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [sessionToken, setSessionToken] = useState<SessionToken | null>(null);

  useEffect(() => {
    async function fetchArticle() {
      try {
        const res = await fetch(`http://localhost:4000/article/${articleId}`);
        if (res.ok) {
          const data: ArticleResponse = await res.json();
          setArticle(data.article);
        } else {
          // Use mock data
          setArticle(MOCK_ARTICLES[articleId] || null);
        }
      } catch (e) {
        // Use mock data if API is not running
        setArticle(MOCK_ARTICLES[articleId] || null);
      } finally {
        setLoading(false);
      }
    }
    fetchArticle();
  }, [articleId]);

  const handleUnlock = async () => {
    try {
      // Step 1: Create payment challenge
      const challengeRes = await fetch("http://localhost:4000/credits/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      
      if (!challengeRes.ok) {
        throw new Error("Failed to create payment challenge");
      }

      const challengeData = await challengeRes.json();
      setModalTitle("Payment Challenge (HTTP 402)");
      setModalContent(challengeData);
      setPaymentState("challenge");
      setShowModal(true);
    } catch (e) {
      // Show mock challenge if API is not running
      const mockChallenge = {
        status: 402,
        message: "Payment required to access this content",
        challenge: {
          challengeId: `chal_mock_${Date.now()}`,
          resourceId: articleId,
          amountRequired: article?.price || 50,
          currency: "USD",
          description: `Unlock: ${article?.title || "Article"}`,
          payTo: "0xDecagon_Treasury_Placeholder",
          expiresAt: new Date(Date.now() + 600000).toISOString(),
          createdAt: new Date().toISOString(),
        },
        preview: {
          text: "Premium content preview...",
          hasMore: true,
          previewPercent: 20,
        },
        acceptedPaymentMethods: [
          { type: "plasma", name: "Plasma Stablecoin", available: false },
          { type: "session_credit", name: "Session Credits", available: true },
        ],
      };
      setModalTitle("Payment Challenge (HTTP 402)");
      setModalContent(mockChallenge);
      setPaymentState("challenge");
      setShowModal(true);
    }
  };

  const handleMockPayment = async () => {
    try {
      const challenge = modalContent?.challenge;
      if (!challenge) return;

      const verifyRes = await fetch("http://localhost:4000/pay/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          resourceId: challenge.resourceId,
          transactionRef: `mock_tx_${Date.now()}`,
        }),
      });

      if (!verifyRes.ok) {
        throw new Error("Failed to verify payment");
      }

      const verifyData = await verifyRes.json();
      setReceipt(verifyData.receipt);
      setSessionToken(verifyData.sessionToken);
      setModalTitle("🎉 Payment Successful!");
      setModalContent(verifyData);
      setPaymentState("paid");
    } catch (e) {
      // Show mock receipt if API is not running
      const mockReceipt: Receipt = {
        receiptId: `rcpt_mock_${Date.now()}`,
        challengeId: modalContent?.challenge?.challengeId || "mock",
        resourceId: articleId,
        amountPaid: article?.price || 50,
        currency: "USD",
        transactionRef: `mock_tx_${Date.now()}`,
        verifiedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };
      const mockSession: SessionToken = {
        tokenId: `sess_mock_${Date.now()}`,
        balance: article?.price || 50,
        currency: "USD",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        accessCount: 0,
      };
      setReceipt(mockReceipt);
      setSessionToken(mockSession);
      setModalTitle("🎉 Payment Successful!");
      setModalContent({ receipt: mockReceipt, sessionToken: mockSession, success: true });
      setPaymentState("paid");
    }
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
        {/* Preview content - always visible */}
        <p>{article.preview}</p>

        {/* Premium content - blurred unless paid */}
        {paymentState === "paid" ? (
          <>
            <hr style={{ margin: "2rem 0", border: "none", borderTop: "1px solid var(--border)" }} />
            <p style={{ color: "var(--success)", fontWeight: 600, marginBottom: "1rem" }}>
              ✓ Premium Content Unlocked
            </p>
            <p>{article.premiumContent}</p>
          </>
        ) : (
          <div className="premium-blur">
            <p className="premium-overlay">
              {article.premiumContent.slice(0, 200)}...
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
              Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
              Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
            </p>
          </div>
        )}
      </div>

      {/* Unlock Section */}
      {paymentState !== "paid" && (
        <div className="unlock-section">
          <h3>🔒 Premium Content</h3>
          <p>
            Unlock the full article for just {formatPrice(article.price, article.currency)}
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
              <span className="receipt-label">Session Balance</span>
              <span className="receipt-value">
                {formatPrice(sessionToken.balance, sessionToken.currency)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modalTitle}</h2>
            
            {paymentState === "challenge" && (
              <p style={{ marginBottom: "1rem", color: "var(--text-secondary)" }}>
                This is the HTTP 402 response payload. In production, you would complete
                payment via Plasma stablecoin.
              </p>
            )}

            <div className="json-display">
              {JSON.stringify(modalContent, null, 2)}
            </div>

            <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              {paymentState === "challenge" && (
                <button className="btn btn-success" onClick={handleMockPayment}>
                  Simulate Payment ✓
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                {paymentState === "paid" ? "Close" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
