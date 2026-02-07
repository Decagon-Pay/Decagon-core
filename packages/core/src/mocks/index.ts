/**
 * Mock Implementations - Step 4
 * 
 * In-memory mock implementations of all capabilities.
 * For development and testing purposes only.
 */

import { Effect, Layer } from "effect";
import type { Article, Receipt, SessionToken, PaymentChallenge, ApiError, NotFoundError, InternalError, SpendPolicy, Agent } from "@decagon/x402";
import { DEFAULT_SPEND_POLICY } from "@decagon/x402";
import { 
  ArticlesStore, 
  ReceiptsStore, 
  ChallengesStore,
  PolicyStore,
  AgentStore,
  UsageStore,
  Clock, 
  IdGen, 
  Logger,
  PaymentVerifier,
  ChainConfigService,
  PlasmaRpc,
  rpcError,
  type PaymentProof,
  type VerificationResult,
  type ChainConfig,
  type RpcTransaction,
  type RpcTransactionReceipt,
  type RpcBlock
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
const challengesDb = new Map<string, PaymentChallenge>();
const usedTransactions = new Set<string>();
const policiesDb = new Map<string, SpendPolicy>();
const agentsDb = new Map<string, Agent>();
const agentsByToken = new Map<string, Agent>();
const usageDb = new Map<string, number>(); // key: "subjectId:dayKey" -> cents

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
// Mock ReceiptsStore - Step 2
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
            : Effect.fail(notFound("Receipt", receiptId) as ApiError)
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
            : Effect.fail(notFound("Session", tokenId) as ApiError)
        )
      ),

    consumeCredits: (tokenId: string, amount: number) =>
      Effect.gen(function* () {
        const session = sessionsDb.get(tokenId);
        if (!session) {
          return yield* Effect.fail(notFound("Session", tokenId) as ApiError);
        }
        if (session.credits < amount) {
          return yield* Effect.fail(internalError(`Insufficient credits: need ${amount}, have ${session.credits}`) as ApiError);
        }
        const updated: SessionToken = {
          ...session,
          credits: session.credits - amount,
          accessCount: session.accessCount + 1,
        };
        sessionsDb.set(tokenId, updated);
        return updated;
      }),

    addCredits: (tokenId: string, amount: number) =>
      Effect.gen(function* () {
        const session = sessionsDb.get(tokenId);
        if (!session) {
          return yield* Effect.fail(notFound("Session", tokenId) as ApiError);
        }
        const updated: SessionToken = {
          ...session,
          credits: session.credits + amount,
        };
        sessionsDb.set(tokenId, updated);
        return updated;
      }),

    hasReceiptForChallenge: (challengeId: string) =>
      Effect.succeed(
        Array.from(receiptsDb.values()).some((r) => r.challengeId === challengeId)
      ),
  })
);

// ============================================
// Mock ChallengesStore
// ============================================

export const MockChallengesStore = Layer.succeed(
  ChallengesStore,
  ChallengesStore.of({
    save: (challenge: PaymentChallenge) =>
      Effect.sync(() => {
        challengesDb.set(challenge.challengeId, challenge);
        return challenge;
      }),

    get: (challengeId: string) =>
      Effect.sync(() => challengesDb.get(challengeId)).pipe(
        Effect.flatMap((challenge) =>
          challenge
            ? Effect.succeed(challenge)
            : Effect.fail(notFound("Challenge", challengeId) as ApiError)
        )
      ),

    markPaid: (challengeId: string) =>
      Effect.gen(function* () {
        const challenge = challengesDb.get(challengeId);
        if (!challenge) {
          return yield* Effect.fail(notFound("Challenge", challengeId) as ApiError);
        }
        const updated: PaymentChallenge = { ...challenge, status: "paid" };
        challengesDb.set(challengeId, updated);
        return updated;
      }),

    markExpired: (challengeId: string) =>
      Effect.gen(function* () {
        const challenge = challengesDb.get(challengeId);
        if (!challenge) {
          return yield* Effect.fail(notFound("Challenge", challengeId) as ApiError);
        }
        const updated: PaymentChallenge = { ...challenge, status: "expired" };
        challengesDb.set(challengeId, updated);
        return updated;
      }),

    exists: (challengeId: string) =>
      Effect.succeed(challengesDb.has(challengeId)),
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

    futureHours: (hours: number) =>
      Effect.sync(() => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()),

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
// Mock PaymentVerifier - Step 2
// ============================================

export const MockPaymentVerifier = Layer.succeed(
  PaymentVerifier,
  PaymentVerifier.of({
    verify: (challenge, proof) =>
      Effect.sync((): VerificationResult => {
        // Mock: always succeeds - simulates successful blockchain verification
        return {
          valid: true,
          verifiedAmount: challenge.amountRequired,
          verifiedAt: new Date().toISOString(),
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
// Mock PolicyStore - Step 3
// ============================================

let agentIdCounter = 0;

export const MockPolicyStore = Layer.succeed(
  PolicyStore,
  PolicyStore.of({
    getUserPolicy: (userId: string) =>
      Effect.sync(() => policiesDb.get(userId) ?? DEFAULT_SPEND_POLICY),

    setUserPolicy: (userId: string, policy: SpendPolicy) =>
      Effect.sync(() => {
        policiesDb.set(userId, policy);
        return policy;
      }),

    hasUserPolicy: (userId: string) =>
      Effect.succeed(policiesDb.has(userId)),
  })
);

// ============================================
// Mock AgentStore - Step 3
// ============================================

export const MockAgentStore = Layer.succeed(
  AgentStore,
  AgentStore.of({
    createAgent: (userId: string, name: string, policy: SpendPolicy) =>
      Effect.sync(() => {
        const agentId = `agent_${++agentIdCounter}_${Date.now().toString(36)}`;
        const agentToken = `agt_${crypto.randomUUID().replace(/-/g, "")}`;
        const agent: Agent = {
          agentId,
          agentToken,
          userId,
          policy,
          name,
          createdAt: new Date().toISOString(),
        };
        agentsDb.set(agentId, agent);
        agentsByToken.set(agentToken, agent);
        return agent;
      }),

    getAgentByToken: (agentToken: string) =>
      Effect.sync(() => agentsByToken.get(agentToken)).pipe(
        Effect.flatMap((agent) =>
          agent
            ? Effect.succeed(agent)
            : Effect.fail({
                _tag: "AgentNotAuthorisedError",
                message: `Invalid agent token`,
                timestamp: new Date().toISOString(),
                agentToken,
                reason: "Token not found",
              } as ApiError)
        )
      ),

    getAgentById: (agentId: string) =>
      Effect.sync(() => agentsDb.get(agentId)).pipe(
        Effect.flatMap((agent) =>
          agent
            ? Effect.succeed(agent)
            : Effect.fail(notFound("Agent", agentId) as ApiError)
        )
      ),

    listAgentsByUser: (userId: string) =>
      Effect.sync(() =>
        Array.from(agentsDb.values()).filter((a) => a.userId === userId)
      ),

    updateLastUsed: (agentId: string) =>
      Effect.gen(function* () {
        const agent = agentsDb.get(agentId);
        if (!agent) {
          return yield* Effect.fail(notFound("Agent", agentId) as ApiError);
        }
        const updated: Agent = {
          ...agent,
          lastUsedAt: new Date().toISOString(),
        };
        agentsDb.set(agentId, updated);
        agentsByToken.set(agent.agentToken, updated);
        return updated;
      }),

    deleteAgent: (agentId: string) =>
      Effect.sync(() => {
        const agent = agentsDb.get(agentId);
        if (agent) {
          agentsByToken.delete(agent.agentToken);
          agentsDb.delete(agentId);
        }
      }),
  })
);

// ============================================
// Mock UsageStore - Step 3
// ============================================

export const MockUsageStore = Layer.succeed(
  UsageStore,
  UsageStore.of({
    getDailySpendCents: (subjectId: string, dayKey: string) =>
      Effect.succeed(usageDb.get(`${subjectId}:${dayKey}`) ?? 0),

    addSpendCents: (subjectId: string, dayKey: string, amountCents: number) =>
      Effect.sync(() => {
        const key = `${subjectId}:${dayKey}`;
        const current = usageDb.get(key) ?? 0;
        usageDb.set(key, current + amountCents);
      }),

    resetDailySpend: (subjectId: string, dayKey: string) =>
      Effect.sync(() => {
        usageDb.delete(`${subjectId}:${dayKey}`);
      }),
  })
);

// ============================================
// Mock ChainConfig - Step 4
// ============================================

const DEFAULT_CHAIN_CONFIG: ChainConfig = {
  chainId: 9746,
  chainName: "Plasma Testnet",
  rpcUrl: process.env["PLASMA_RPC_URL"] ?? "https://testnet-rpc.plasma.to",
  assetType: "NATIVE",
  assetSymbol: "XPL",
  assetDecimals: 18,
  payeeAddress: process.env["PAYEE_ADDRESS"] ?? "0x85F491cB77b4e83b49dE62D3fd03e6b2622CbE3d",
  explorerTxBase: process.env["PLASMA_EXPLORER_TX_BASE"] ?? "https://testnet.plasmascan.to/tx/",
  topupPriceWei: process.env["TOPUP_PRICE_WEI"] ?? "100000000000000", // 0.0001 XPL
  topupPriceDisplay: process.env["TOPUP_PRICE_XPL"] ?? "0.0001",
};

export const MockChainConfig = Layer.succeed(
  ChainConfigService,
  ChainConfigService.of({
    getConfig: () => Effect.succeed(DEFAULT_CHAIN_CONFIG),
  })
);

// ============================================
// Mock PlasmaRpc - Step 4 (for testing only)
// ============================================

// Mock transaction database for testing
const mockTransactions = new Map<string, RpcTransaction>();
const mockReceipts = new Map<string, RpcTransactionReceipt>();

export const MockPlasmaRpc = Layer.succeed(
  PlasmaRpc,
  PlasmaRpc.of({
    getTransaction: (txHash: string) =>
      Effect.succeed(mockTransactions.get(txHash) ?? null),

    getTransactionReceipt: (txHash: string) =>
      Effect.succeed(mockReceipts.get(txHash) ?? null),

    getBlock: (_blockNumber: string | "latest") =>
      Effect.succeed({
        number: "0x100",
        hash: "0xmockblockhash",
        timestamp: `0x${Math.floor(Date.now() / 1000).toString(16)}`,
        parentHash: "0x0",
        miner: "0x0",
        gasUsed: "0x0",
        gasLimit: "0x1000000",
      } as RpcBlock),

    getBlockNumber: () =>
      Effect.succeed("0x100"),

    getChainId: () =>
      Effect.succeed("0x2612"), // 9746 in hex
  })
);

// Helper to add mock transactions for testing
export const addMockTransaction = (tx: RpcTransaction, receipt: RpcTransactionReceipt): void => {
  mockTransactions.set(tx.hash, tx);
  mockReceipts.set(receipt.transactionHash, receipt);
};

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
  MockChallengesStore,
  MockPolicyStore,
  MockAgentStore,
  MockUsageStore,
  MockClock,
  MockIdGen,
  MockLogger,
  MockPaymentVerifier,
  // Step 4: Chain integration
  MockChainConfig,
  MockPlasmaRpc
);
