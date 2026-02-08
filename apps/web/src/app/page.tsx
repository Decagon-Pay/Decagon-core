"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/config";

interface Article {
  id: string;
  title: string;
  author: string;
  preview: string;
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

// Fallback mock data in case API is not running
const MOCK_ARTICLES: ArticleResponse[] = [
  {
    article: {
      id: "article-1",
      title: "The Future of Web Monetization",
      author: "Sarah Chen",
      preview: "Web monetization has long been dominated by advertising and subscriptions. But what if there was a better way? In this article, we explore how micro-payments could transform the internet economy...",
      price: 50,
      currency: "USD",
      publishedAt: "2026-01-15T10:00:00Z",
      readTimeMinutes: 8,
      tags: ["web3", "payments", "monetization"],
    },
    hasFullAccess: false,
    content: "Web monetization has long been dominated by advertising and subscriptions...",
  },
  {
    article: {
      id: "article-2",
      title: "HTTP 402: The Forgotten Status Code",
      author: "Marcus Williams",
      preview: "When HTTP status codes were designed, 402 was reserved for 'Payment Required' - but it was never properly defined. Decades later, we finally have the technology to make it useful...",
      price: 75,
      currency: "USD",
      publishedAt: "2026-01-20T14:30:00Z",
      readTimeMinutes: 12,
      tags: ["http", "protocol", "history"],
    },
    hasFullAccess: false,
    content: "When HTTP status codes were designed...",
  },
  {
    article: {
      id: "article-3",
      title: "Building AI Agents That Can Pay",
      author: "Aisha Patel",
      preview: "AI agents are becoming increasingly autonomous. Soon, they'll need to access paid resources without human intervention. How do we build payment systems for machines?...",
      price: 100,
      currency: "USD",
      publishedAt: "2026-02-01T09:00:00Z",
      readTimeMinutes: 15,
      tags: ["ai", "agents", "automation"],
    },
    hasFullAccess: false,
    content: "AI agents are becoming increasingly autonomous...",
  },
  {
    article: {
      id: "article-4",
      title: "Stablecoins for Everyday Payments",
      author: "David Kim",
      preview: "Cryptocurrency volatility has long been a barrier to adoption. Stablecoins offer a solution, but how do they work in practice for small, everyday transactions?...",
      price: 60,
      currency: "USD",
      publishedAt: "2026-02-03T11:00:00Z",
      readTimeMinutes: 10,
      tags: ["stablecoins", "crypto", "payments"],
    },
    hasFullAccess: false,
    content: "Cryptocurrency volatility has long been a barrier...",
  },
  {
    article: {
      id: "article-5",
      title: "The End of Subscription Fatigue",
      author: "Elena Rodriguez",
      preview: "The average consumer now has 12 active subscriptions. Is there a breaking point? Pay-per-use models offer an alternative that benefits both creators and consumers...",
      price: 80,
      currency: "USD",
      publishedAt: "2026-02-05T16:00:00Z",
      readTimeMinutes: 11,
      tags: ["subscriptions", "economics", "ux"],
    },
    hasFullAccess: false,
    content: "The average consumer now has 12 active subscriptions...",
  },
];

function formatPrice(price: number, currency: string): string {
  if (currency === "USD") {
    return `$${(price / 100).toFixed(2)}`;
  }
  return `${price} ${currency}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function HomePage() {
  const [articles, setArticles] = useState<ArticleResponse[]>(MOCK_ARTICLES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArticles() {
      try {
        const res = await fetch(`${API_BASE}/articles`);
        if (res.ok) {
          const data = await res.json();
          setArticles(data.articles);
        } else {
          // Use mock data if API fails
          console.log("API not available, using mock data");
        }
      } catch (e) {
        // Use mock data if API is not running
        console.log("API not available, using mock data");
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, []);

  return (
    <main>
      <section className="hero">
        <div className="container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1>🔷 Pay Once, Read Instantly</h1>
              <p>
                Access premium content with micro-payments. No subscriptions, no accounts.
                Just tap, pay, and read.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <Link href="/remittance" className="btn btn-sm btn-secondary">
                💸 Remittance
              </Link>
              <Link href="/settings" className="btn btn-sm btn-secondary">
                ⚙️ Settings
              </Link>
              <Link href="/agents" className="btn btn-sm btn-secondary">
                🤖 Agents
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container">
        <h2 style={{ marginTop: "2rem", marginBottom: "0.5rem" }}>Featured Articles</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
          Premium content from independent creators
        </p>

        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : (
          <div className="articles-grid">
            {articles.map(({ article }) => (
              <Link
                key={article.id}
                href={`/article/${article.id}`}
                style={{ textDecoration: "none" }}
              >
                <article className="article-card">
                  <h3>{article.title}</h3>
                  <div className="article-meta">
                    <span>{article.author}</span>
                    <span>•</span>
                    <span>{article.readTimeMinutes} min read</span>
                    <span>•</span>
                    <span>{formatDate(article.publishedAt)}</span>
                  </div>
                  <p className="article-preview">
                    {article.preview.slice(0, 150)}...
                  </p>
                  <div className="article-footer">
                    <span className="price-badge">
                      {formatPrice(article.price, article.currency)}
                    </span>
                    <div className="tags">
                      {article.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="container" style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          Powered by HTTP 402 • Built for humans and AI agents
        </p>
      </section>
    </main>
  );
}
