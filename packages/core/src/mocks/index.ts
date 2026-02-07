/**
 * Mock Implementations
 * 
 * In-memory mock implementations of all capabilities.
 * For development and testing purposes only.
 */

import { Effect, Layer } from "effect";
import type { Article, Receipt, SessionToken, ApiError, NotFoundError, InternalError } from "@decagon/x402";
import { 
  ArticlesStore, 
  ReceiptsStore, 
  Clock, 
  IdGen, 
  Logger,
  PaymentVerifier,
  type PaymentProof,
  type VerificationResult
} from "../capabilities/index.js";

// ============================================
// Mock Data
// ============================================

const MOCK_ARTICLES: Article[] = [
  {
    id: "article-1",
    title: "The Future of Web Monetization",
    author: "Sarah Chen",
    preview: "Web monetization has long been dominated by advertising and subscriptions. But what if there was a better way? In this article, we explore how micro-payments could transform the internet economy...",
    premiumContent: "The complete guide to implementing micro-payments on your platform. This includes detailed technical specifications, case studies from early adopters, and a step-by-step implementation guide. We'll cover the HTTP 402 protocol, stablecoin integration, and user experience best practices that maximize conversion while minimizing friction.",
    price: 50, // 50 cents
    currency: "USD",
    publishedAt: "2026-01-15T10:00:00Z",
    readTimeMinutes: 8,
    tags: ["web3", "payments", "monetization"],
  },
  {
    id: "article-2",
    title: "HTTP 402: The Forgotten Status Code",
    author: "Marcus Williams",
    preview: "When HTTP status codes were designed, 402 was reserved for 'Payment Required' - but it was never properly defined. Decades later, we finally have the technology to make it useful...",
    premiumContent: "A deep dive into the history of HTTP 402, from its origins in RFC 2616 to modern implementations. We examine how stablecoins and smart contracts enable trustless payments that the original designers could only dream of. Includes code examples in TypeScript, Go, and Rust.",
    price: 75, // 75 cents
    currency: "USD",
    publishedAt: "2026-01-20T14:30:00Z",
    readTimeMinutes: 12,
    tags: ["http", "protocol", "history"],
  },
  {
    id: "article-3",
    title: "Building AI Agents That Can Pay",
    author: "Aisha Patel",
    preview: "AI agents are becoming increasingly autonomous. Soon, they'll need to access paid resources without human intervention. How do we build payment systems for machines?...",
    premiumContent: "Technical architecture for AI agent payment systems. This covers wallet management, spending limits, audit trails, and safety mechanisms. We present a complete TypeScript implementation that integrates with popular AI frameworks like LangChain and AutoGPT.",
    price: 100, // $1
    currency: "USD",
    publishedAt: "2026-02-01T09:00:00Z",
    readTimeMinutes: 15,
    tags: ["ai", "agents", "automation"],
  },
  {
    id: "article-4",
    title: "Stablecoins for Everyday Payments",
    author: "David Kim",
    preview: "Cryptocurrency volatility has long been a barrier to adoption. Stablecoins offer a solution, but how do they work in practice for small, everyday transactions?...",
    premiumContent: "A practical guide to integrating stablecoins into your payment flow. We cover Plasma, USDC, and other major stablecoins, comparing their fees, settlement times, and developer experience. Includes integration examples for e-commerce, content platforms, and API services.",
    price: 60, // 60 cents
    currency: "USD",
    publishedAt: "2026-02-03T11:00:00Z",
    readTimeMinutes: 10,
    tags: ["stablecoins", "crypto", "payments"],
  },
  {
    id: "article-5",
    title: "The End of Subscription Fatigue",
    author: "Elena Rodriguez",
    preview: "The average consumer now has 12 active subscriptions. Is there a breaking point? Pay-per-use models offer an alternative that benefits both creators and consumers...",
    premiumContent: "Research and analysis on subscription economics versus pay-per-use models. We present data from 50,000 users comparing engagement, satisfaction, and lifetime value across different monetization strategies. Includes a framework for deciding which model fits your content.",
    price: 80, // 80 cents
    currency: "USD",
    publishedAt: "2026-02-05T16:00:00Z",
    readTimeMinutes: 11,
    tags: ["subscriptions", "economics", "ux"],
  },
];

// In-memory stores
const receiptsDb = new Map<string, Receipt>();
const sessionsDb = new Map<string, SessionToken>();
const usedTransactions = new Set<string>();

// ============================================
// Helper Functions
// ============================================

const notFound = (resourceType: string, resourceId: string): NotFoundError => ({
  _tag: "NotFoundError",
  message: `${resourceType} not found: ${resourceId}`,
  timestamp: new Date().toISOString(),
  resourceType,
  resourceId,
});

const internalError = (message: string, cause?: unknown): InternalError => ({
  _tag: "InternalError",
  message,
  timestamp: new Date().toISOString(),
  cause,
});

// ============================================
// Mock ArticlesStore
// ============================================

export const MockArticlesStore = Layer.succeed(
  ArticlesStore,
  ArticlesStore.of({
    getById: (id: string) =>
      Effect.sync(() => MOCK_ARTICLES.find((a) => a.id === id)).pipe(
        Effect.flatMap((article) =>
          article
            ? Effect.succeed(article)
            : Effect.fail(notFound("Article", id))
        )
      ),

    listAll: () => Effect.succeed(MOCK_ARTICLES),

    exists: (id: string) =>
      Effect.succeed(MOCK_ARTICLES.some((a) => a.id === id)),
  })
);

// ============================================
// Mock ReceiptsStore
// ============================================

export const MockReceiptsStore = Layer.succeed(
  ReceiptsStore,
  ReceiptsStore.of({
    saveReceipt: (receipt: Receipt) =>
      Effect.sync(() => {
        receiptsDb.set(receipt.receiptId, receipt);
        return receipt;
      }),

    getReceipt: (receiptId: string) =>
      Effect.sync(() => receiptsDb.get(receiptId)).pipe(
        Effect.flatMap((receipt) =>
          receipt
            ? Effect.succeed(receipt)
            : Effect.fail(notFound("Receipt", receiptId))
        )
      ),

    saveSession: (session: SessionToken) =>
      Effect.sync(() => {
        sessionsDb.set(session.tokenId, session);
        return session;
      }),

    getSession: (tokenId: string) =>
      Effect.sync(() => sessionsDb.get(tokenId)).pipe(
        Effect.flatMap((session) =>
          session
            ? Effect.succeed(session)
            : Effect.fail(notFound("Session", tokenId))
        )
      ),

    updateSessionBalance: (tokenId: string, newBalance: number, newAccessCount: number) =>
      Effect.sync(() => sessionsDb.get(tokenId)).pipe(
        Effect.flatMap((session) => {
          if (!session) {
            return Effect.fail(notFound("Session", tokenId));
          }
          const updated: SessionToken = {
            ...session,
            balance: newBalance,
            accessCount: newAccessCount,
          };
          sessionsDb.set(tokenId, updated);
          return Effect.succeed(updated);
        })
      ),

    hasReceiptForChallenge: (challengeId: string) =>
      Effect.succeed(
        Array.from(receiptsDb.values()).some((r) => r.challengeId === challengeId)
      ),
  })
);

// ============================================
// Mock Clock
// ============================================

export const MockClock = Layer.succeed(
  Clock,
  Clock.of({
    now: () => Effect.sync(() => new Date().toISOString()),

    nowMs: () => Effect.sync(() => Date.now()),

    futureSeconds: (seconds: number) =>
      Effect.sync(() => new Date(Date.now() + seconds * 1000).toISOString()),

    futureMinutes: (minutes: number) =>
      Effect.sync(() => new Date(Date.now() + minutes * 60 * 1000).toISOString()),

    isPast: (isoTimestamp: string) =>
      Effect.sync(() => new Date(isoTimestamp).getTime() < Date.now()),
  })
);

// ============================================
// Mock IdGen
// ============================================

let idCounter = 0;

export const MockIdGen = Layer.succeed(
  IdGen,
  IdGen.of({
    challengeId: () =>
      Effect.sync(() => `chal_${++idCounter}_${Date.now().toString(36)}`),

    receiptId: () =>
      Effect.sync(() => `rcpt_${++idCounter}_${Date.now().toString(36)}`),

    sessionTokenId: () =>
      Effect.sync(() => `sess_${++idCounter}_${Date.now().toString(36)}`),

    generate: (prefix: string) =>
      Effect.sync(() => `${prefix}_${++idCounter}_${Date.now().toString(36)}`),
  })
);

// ============================================
// Mock Logger
// ============================================

export const MockLogger = Layer.succeed(
  Logger,
  Logger.of({
    debug: (message, context) =>
      Effect.sync(() => {
        console.debug(`[DEBUG] ${message}`, context ?? "");
      }),

    info: (message, context) =>
      Effect.sync(() => {
        console.info(`[INFO] ${message}`, context ?? "");
      }),

    warn: (message, context) =>
      Effect.sync(() => {
        console.warn(`[WARN] ${message}`, context ?? "");
      }),

    error: (message, context) =>
      Effect.sync(() => {
        console.error(`[ERROR] ${message}`, context ?? "");
      }),

    log: (level, message, context) =>
      Effect.sync(() => {
        const prefix = `[${level.toUpperCase()}]`;
        console.log(`${prefix} ${message}`, context ?? "");
      }),
  })
);

// ============================================
// Mock PaymentVerifier
// ============================================

export const MockPaymentVerifier = Layer.succeed(
  PaymentVerifier,
  PaymentVerifier.of({
    verify: (challenge, proof) =>
      Effect.sync((): VerificationResult => {
        // Mock: always succeeds if amount matches
        const valid = proof.amount >= challenge.amountRequired;
        return {
          valid,
          verifiedAmount: proof.amount,
          verifiedAt: new Date().toISOString(),
          errorMessage: valid ? undefined : "Insufficient payment amount",
        };
      }),

    isTransactionUsed: (transactionRef: string) =>
      Effect.succeed(usedTransactions.has(transactionRef)),

    markTransactionUsed: (transactionRef: string) =>
      Effect.sync(() => {
        usedTransactions.add(transactionRef);
      }),
  })
);

// ============================================
// Combined Mock Layer
// ============================================

/**
 * All mock capabilities combined into a single Layer.
 * Use this for development and testing.
 */
export const MockCapabilities = Layer.mergeAll(
  MockArticlesStore,
  MockReceiptsStore,
  MockClock,
  MockIdGen,
  MockLogger,
  MockPaymentVerifier
);
