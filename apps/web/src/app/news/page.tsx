"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  User,
  Lock,
  ArrowRight,
  Loader2,
  Newspaper,
} from "lucide-react";
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

function formatPrice(price: number, currency: string): string {
  if (currency === "USD") return `$${(price / 100).toFixed(2)}`;
  return `${price} ${currency}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Fallback mock data (abridged) in case API is unreachable
const FALLBACK_ARTICLES: ArticleResponse[] = [
  {
    article: { id: "article-1", title: "The Future of Web Monetization", author: "Sarah Chen", preview: "Web monetization has long been dominated by advertising and subscriptions. But what if there was a better way?...", price: 50, currency: "USD", publishedAt: "2026-01-15T10:00:00Z", readTimeMinutes: 8, tags: ["web3", "payments", "monetization"] },
    hasFullAccess: false, content: "",
  },
  {
    article: { id: "article-2", title: "HTTP 402: The Forgotten Status Code", author: "Marcus Williams", preview: "When HTTP status codes were designed, 402 was reserved for 'Payment Required', but it was never properly defined...", price: 75, currency: "USD", publishedAt: "2026-01-20T14:30:00Z", readTimeMinutes: 12, tags: ["http", "protocol", "history"] },
    hasFullAccess: false, content: "",
  },
  {
    article: { id: "article-3", title: "Building AI Agents That Can Pay", author: "Aisha Patel", preview: "AI agents are becoming increasingly autonomous. Soon, they'll need to access paid resources without human intervention...", price: 100, currency: "USD", publishedAt: "2026-02-01T09:00:00Z", readTimeMinutes: 15, tags: ["ai", "agents", "automation"] },
    hasFullAccess: false, content: "",
  },
  {
    article: { id: "article-4", title: "Stablecoins for Everyday Payments", author: "David Kim", preview: "Cryptocurrency volatility has long been a barrier to adoption. Stablecoins offer a solution...", price: 60, currency: "USD", publishedAt: "2026-02-03T11:00:00Z", readTimeMinutes: 10, tags: ["stablecoins", "crypto", "payments"] },
    hasFullAccess: false, content: "",
  },
  {
    article: { id: "article-5", title: "The End of Subscription Fatigue", author: "Elena Rodriguez", preview: "The average consumer now has 12 active subscriptions. Is there a breaking point?...", price: 80, currency: "USD", publishedAt: "2026-02-05T16:00:00Z", readTimeMinutes: 11, tags: ["subscriptions", "economics", "ux"] },
    hasFullAccess: false, content: "",
  },
  {
    article: { id: "article-6", title: "Zero-Knowledge Proofs Meet Micropayments", author: "Liam O'Connor", preview: "Privacy and payments have always been at odds. Zero-knowledge proofs offer a way to verify transactions without revealing the buyer's identity...", price: 90, currency: "USD", publishedAt: "2026-02-10T08:00:00Z", readTimeMinutes: 14, tags: ["privacy", "zk-proofs", "cryptography"] },
    hasFullAccess: false, content: "",
  },
  {
    article: { id: "article-7", title: "Designing Payment UX That Converts", author: "Maya Johnson", preview: "The difference between a 2% and a 12% conversion rate on a paywall often comes down to design...", price: 70, currency: "USD", publishedAt: "2026-02-14T12:00:00Z", readTimeMinutes: 9, tags: ["design", "ux", "conversion"] },
    hasFullAccess: false, content: "",
  },
  {
    article: { id: "article-8", title: "The Legal Landscape of Onchain Payments", author: "James Hartley", preview: "As onchain payments go mainstream, regulators are paying attention...", price: 85, currency: "USD", publishedAt: "2026-02-18T15:00:00Z", readTimeMinutes: 13, tags: ["legal", "regulation", "compliance"] },
    hasFullAccess: false, content: "",
  },
  {
    article: { id: "article-9", title: "Plasma Network: The Layer 2 Built for Payments", author: "Yuki Tanaka", preview: "Not all Layer 2s are created equal. Plasma Network was designed from the ground up for payments...", price: 65, currency: "USD", publishedAt: "2026-02-22T10:00:00Z", readTimeMinutes: 11, tags: ["plasma", "layer2", "infrastructure"] },
    hasFullAccess: false, content: "",
  },
  {
    article: { id: "article-10", title: "From Paywall to Pay-Per-Query: Monetising APIs", author: "Raj Krishnamurthy", preview: "APIs are the backbone of the modern internet. What happens when every API call can be individually priced?...", price: 95, currency: "USD", publishedAt: "2026-02-28T09:00:00Z", readTimeMinutes: 12, tags: ["apis", "monetization", "infrastructure"] },
    hasFullAccess: false, content: "",
  },
];

export default function NewsPage() {
  const [articles, setArticles] = useState<ArticleResponse[]>(FALLBACK_ARTICLES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchArticles() {
      try {
        const res = await fetch(`${API_BASE}/articles`);
        if (res.ok) {
          const data = await res.json();
          setArticles(data.articles);
        }
      } catch {
        // fall through to mock data
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, []);

  // Featured = first article; rest go in the grid
  const featured = articles[0];
  const rest = articles.slice(1);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <Newspaper className="h-5 w-5 text-primary" />
          <Badge variant="muted">News Demo</Badge>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          The Decagon Chronicle
        </h1>
        <p className="mt-2 text-muted-foreground max-w-xl">
          Premium articles from independent writers. Pay per article, no subscription, no account.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Featured article */}
          {featured && (
            <Link href={`/news/${featured.article.id}`} className="group block mb-10 no-underline">
              <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                <div className="grid md:grid-cols-5">
                  <div className="md:col-span-2 gradient-primary flex items-center justify-center min-h-[200px]">
                    <Newspaper className="h-20 w-20 text-white/60" />
                  </div>
                  <CardContent className="md:col-span-3 p-6 sm:p-8 flex flex-col justify-center">
                    <Badge variant="default" className="self-start mb-3">Featured</Badge>
                    <h2 className="text-xl sm:text-2xl font-bold mb-2 group-hover:text-primary transition-colors">
                      {featured.article.title}
                    </h2>
                    <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                      {featured.article.preview}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{featured.article.author}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{featured.article.readTimeMinutes} min</span>
                      <span>{formatDate(featured.article.publishedAt)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                      <Badge variant="outline" className="gap-1">
                        <Lock className="h-3 w-3" />
                        {formatPrice(featured.article.price, featured.article.currency)}
                      </Badge>
                      <span className="text-sm font-medium text-primary flex items-center gap-1">
                        Read article <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </CardContent>
                </div>
              </Card>
            </Link>
          )}

          {/* Article grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map(({ article }) => (
              <Link
                key={article.id}
                href={`/news/${article.id}`}
                className="group no-underline"
              >
                <Card className="h-full flex flex-col hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                  <CardContent className="p-5 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {article.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-1">
                      {article.preview.slice(0, 120)}…
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-3 border-t">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{article.author.split(" ")[1]}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{article.readTimeMinutes}m</span>
                      </div>
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Lock className="h-2.5 w-2.5" />
                        {formatPrice(article.price, article.currency)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
