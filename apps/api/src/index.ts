/**
 * Decagon API Server - Step 5
 * 
 * Fastify HTTP server that serves as the edge layer.
 * Implements HTTP 402 payment flow with session tokens, credits, and policy enforcement.
 * 
 * Supports two modes:
 * - Mock mode (default in dev): In-memory stores for quick testing
 * - SQLite mode (USE_SQLITE=true): Persistent SQLite storage for production
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import { Effect, Exit, Layer } from "effect";
import {
  getArticle,
  listArticles,
  verifyPaymentAndIssueSession,
  getBalance,
  getUserPolicy,
  setUserPolicy,
  createAgent,
  listAgents,
  getAgentByToken,
  checkPaymentPolicy,
  recordSpend,
  MockCapabilities,
  MockArticlesStore,
  MockChallengesStore,
  MockClock,
  MockIdGen,
  MockLogger,
  MockPaymentVerifier,
  MockChainConfig,
  MockPlasmaRpc,
} from "@decagon/core";
import type { ApiError, PaymentRequiredError, SpendPolicy } from "@decagon/x402";
import { DEFAULT_SPEND_POLICY, TOPUP_PRICE_CENTS } from "@decagon/x402";
import {
  LiveReceiptsStore,
  LivePolicyStore,
  LiveAgentStore,
  LiveUsageStore,
  getDb,
  closeDb,
} from "./sqlite/index.js";

// ============================================
// Environment Configuration
// ============================================

const USE_SQLITE = process.env["USE_SQLITE"] === "true" || process.env["NODE_ENV"] === "production";
const PORT = parseInt(process.env["PORT"] ?? "4000", 10);
const HOST = process.env["HOST"] ?? "0.0.0.0";

// CORS origins
const ALLOWED_ORIGINS = process.env["ALLOWED_ORIGINS"]
  ? process.env["ALLOWED_ORIGINS"].split(",").map((s) => s.trim())
  : ["http://localhost:3000", "http://localhost:3001"];

console.log(`[Config] USE_SQLITE: ${USE_SQLITE}`);
console.log(`[Config] ALLOWED_ORIGINS: ${ALLOWED_ORIGINS.join(", ")}`);

// ============================================
// Server Setup
// ============================================

const server = Fastify({
  logger: true,
});

// Enable CORS for frontend
await server.register(cors, {
  origin: ALLOWED_ORIGINS,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-User-Id"],
  exposedHeaders: ["X-Payment-Required", "X-Challenge-Id"],
});

// ============================================
// Capability Layer Selection
// ============================================

/**
 * SQLite-backed capabilities for production
 * Uses SQLite for persistent stores, mock for stateless services
 */
const SqliteCapabilities = Layer.mergeAll(
  MockArticlesStore,        // Articles are static
  LiveReceiptsStore,        // Persistent
  MockChallengesStore,      // Short-lived, can be in-memory
  LivePolicyStore,          // Persistent
  LiveAgentStore,           // Persistent
  LiveUsageStore,           // Persistent
  MockClock,                // Stateless
  MockIdGen,                // Stateless
  MockLogger,               // Stateless (could add file logging later)
  MockPaymentVerifier,      // TODO: Use live verifier for on-chain
  MockChainConfig,          // Config from env
  MockPlasmaRpc,            // TODO: Use live RPC
);

// Choose capabilities based on mode
const Capabilities = USE_SQLITE ? SqliteCapabilities : MockCapabilities;

// Initialize SQLite if enabled
if (USE_SQLITE) {
  console.log("[SQLite] Initializing database...");
  getDb(); // This creates tables if needed
}

// ============================================
// Effect Runtime Helper
// ============================================

/**
 * Run an Effect workflow with capabilities and convert to Promise
 */
const runWorkflow = <A, E extends ApiError>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  effect: Effect.Effect<A, E, never> | Effect.Effect<A, E, any>
): Promise<{ ok: true; data: A } | { ok: false; error: E }> =>
  Effect.runPromiseExit(
    Effect.provide(effect as Effect.Effect<A, E, never>, Capabilities)
  ).then((exit) => {
    if (Exit.isSuccess(exit)) {
      return { ok: true as const, data: exit.value };
    } else {
      const cause = exit.cause;
      if (cause._tag === "Fail") {
        return { ok: false as const, error: cause.error as E };
      }
      return {
        ok: false as const,
        error: {
          _tag: "InternalError",
          message: "Unexpected error",
          timestamp: new Date().toISOString(),
        } as E,
      };
    }
  });

/**
 * Map ApiError to HTTP status code
 */
const errorToStatusCode = (error: ApiError): number => {
  switch (error._tag) {
    case "NotFoundError":
      return 404;
    case "PaymentRequiredError":
      return 402;
    case "InvalidPaymentError":
      return 400;
    case "SessionExpiredError":
      return 401;
    case "InsufficientCreditsError":
      return 402;
    case "ValidationError":
      return 400;
    case "InternalError":
    default:
      return 500;
  }
};

/**
 * Extract session token from Authorization header
 */
const extractSessionToken = (authHeader: string | undefined): string | undefined => {
  if (!authHeader) return undefined;
  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : undefined;
};

/**
 * Extract agent token from Authorization header (starts with "agt_")
 */
const extractAgentToken = (authHeader: string | undefined): string | undefined => {
  const token = extractSessionToken(authHeader);
  return token?.startsWith("agt_") ? token : undefined;
};

/**
 * Get user ID from header or default to "demo-user"
 */
const getUserId = (request: { headers: { "x-user-id"?: string } }): string => {
  return request.headers["x-user-id"] ?? "demo-user";
};

// ============================================
// Routes
// ============================================

/**
 * Health check endpoint
 */
server.get("/health", async () => {
  return { ok: true, timestamp: new Date().toISOString() };
});

/**
 * Get article by ID - HTTP 402 flow
 * - No session token → 402 with PaymentChallenge
 * - Expired session → 402 with PaymentChallenge
 * - Insufficient credits → 402 with PaymentChallenge
 * - Valid session with credits → 200 with full content (1 credit consumed)
 */
server.get<{
  Params: { id: string };
  Headers: { authorization?: string };
}>("/article/:id", async (request, reply) => {
  const { id } = request.params;
  const sessionTokenId = extractSessionToken(request.headers.authorization);

  const result = await runWorkflow(getArticle({ 
    articleId: id, 
    sessionTokenId 
  }));

  if (!result.ok) {
    const error = result.error;
    
    // Special handling for 402 responses
    if (error._tag === "PaymentRequiredError") {
      const paymentError = error as PaymentRequiredError;
      reply.header("X-Payment-Required", "true");
      reply.header("X-Challenge-Id", paymentError.challenge.challengeId);
      
      return reply.status(402).send({
        status: 402,
        message: paymentError.message,
        challenge: paymentError.challenge,
        acceptedPaymentMethods: [
          { type: "usdt", name: "USDT on Plasma", available: true },
        ],
      });
    }
    
    return reply.status(errorToStatusCode(error)).send(error);
  }

  return result.data;
});

/**
 * List all articles (preview only, no auth required)
 */
server.get("/articles", async (request, reply) => {
  const result = await runWorkflow(listArticles());

  if (!result.ok) {
    return reply.status(errorToStatusCode(result.error)).send(result.error);
  }

  return { articles: result.data };
});

/**
 * Get current credit balance
 * GET /credits/balance
 */
server.get<{
  Headers: { authorization?: string };
}>("/credits/balance", async (request, reply) => {
  const sessionTokenId = extractSessionToken(request.headers.authorization);

  if (!sessionTokenId) {
    return reply.status(401).send({
      _tag: "ValidationError",
      message: "Authorization header required",
      timestamp: new Date().toISOString(),
      field: "Authorization",
      reason: "Missing Bearer token",
    });
  }

  const result = await runWorkflow(getBalance(sessionTokenId));

  if (!result.ok) {
    return reply.status(errorToStatusCode(result.error)).send(result.error);
  }

  return {
    credits: result.data.credits,
    expiresAt: result.data.expiresAt,
  };
});

/**
 * Verify payment and issue/update session with credits
 * POST /pay/verify
 * 
 * Accepts either:
 * - txHash: actual blockchain transaction hash (Step 4)
 * - transactionRef + payerAddress: legacy mock payment
 */
server.post<{
  Body: {
    challengeId: string;
    txHash?: string;
    transactionRef?: string;
    payerAddress?: string;
  };
  Headers: { authorization?: string };
}>("/pay/verify", async (request, reply) => {
  const { challengeId, txHash, transactionRef, payerAddress } = request.body ?? {};

  if (!challengeId) {
    return reply.status(400).send({
      _tag: "ValidationError",
      message: "Missing required field: challengeId",
      timestamp: new Date().toISOString(),
      field: "body",
      reason: "Missing challengeId",
    });
  }

  // Must have either txHash or transactionRef
  if (!txHash && !transactionRef) {
    return reply.status(400).send({
      _tag: "ValidationError",
      message: "Missing required field: txHash or transactionRef",
      timestamp: new Date().toISOString(),
      field: "body",
      reason: "Missing payment proof",
    });
  }

  // Check if there's an existing session token to add credits to
  const existingSessionTokenId = extractSessionToken(request.headers.authorization);

  const result = await runWorkflow(
    verifyPaymentAndIssueSession({
      challengeId,
      txHash,
      transactionRef,
      payerAddress,
      existingSessionTokenId,
    })
  );

  if (!result.ok) {
    return reply.status(errorToStatusCode(result.error)).send(result.error);
  }

  return {
    success: true,
    receipt: result.data.receipt,
    sessionToken: result.data.sessionToken,
    message: `Payment verified! You now have ${result.data.sessionToken.credits} credits.`,
  };
});

// ============================================
// Policy Management Routes - Step 3
// ============================================

/**
 * Get current spend policy for user
 * GET /policy
 */
server.get<{
  Headers: { "x-user-id"?: string };
}>("/policy", async (request, reply) => {
  const userId = getUserId(request);
  
  const result = await runWorkflow(getUserPolicy(userId));
  
  if (!result.ok) {
    return reply.status(errorToStatusCode(result.error)).send(result.error);
  }
  
  return {
    userId,
    policy: result.data,
  };
});

/**
 * Set spend policy for user
 * POST /policy
 */
server.post<{
  Body: {
    policy?: Partial<SpendPolicy>;
  };
  Headers: { "x-user-id"?: string };
}>("/policy", async (request, reply) => {
  const userId = getUserId(request);
  const policyInput = request.body?.policy ?? {};
  
  // Merge with defaults
  const policy: SpendPolicy = {
    maxPerActionCents: policyInput.maxPerActionCents ?? DEFAULT_SPEND_POLICY.maxPerActionCents,
    dailyCapCents: policyInput.dailyCapCents ?? DEFAULT_SPEND_POLICY.dailyCapCents,
    autoApproveUnderCents: policyInput.autoApproveUnderCents ?? DEFAULT_SPEND_POLICY.autoApproveUnderCents,
    requireConfirmAboveCents: policyInput.requireConfirmAboveCents ?? DEFAULT_SPEND_POLICY.requireConfirmAboveCents,
    allowedOrigins: policyInput.allowedOrigins ?? DEFAULT_SPEND_POLICY.allowedOrigins,
    allowedPaths: policyInput.allowedPaths ?? DEFAULT_SPEND_POLICY.allowedPaths,
  };
  
  const result = await runWorkflow(setUserPolicy(userId, policy));
  
  if (!result.ok) {
    return reply.status(errorToStatusCode(result.error)).send(result.error);
  }
  
  return {
    ok: true,
    userId,
    policy: result.data,
  };
});

/**
 * Check policy for a proposed payment
 * POST /policy/check
 */
server.post<{
  Body: {
    amountCents?: number;
    path?: string;
  };
  Headers: { authorization?: string; "x-user-id"?: string; origin?: string };
}>("/policy/check", async (request, reply) => {
  const userId = getUserId(request);
  const agentToken = extractAgentToken(request.headers.authorization);
  const amountCents = request.body?.amountCents ?? TOPUP_PRICE_CENTS;
  const path = request.body?.path ?? "/article/*";
  const origin = request.headers.origin;
  
  const result = await runWorkflow(
    checkPaymentPolicy({
      amountCents,
      origin,
      path,
      userId: agentToken ? undefined : userId,
      agentToken,
    })
  );
  
  if (!result.ok) {
    return reply.status(errorToStatusCode(result.error)).send(result.error);
  }
  
  if (!result.data.allowed) {
    return reply.status(403).send({
      allowed: false,
      error: result.data.error,
      policy: result.data.policy,
      currentDailySpend: result.data.currentDailySpend,
    });
  }
  
  return {
    allowed: true,
    needsConfirm: result.data.needsConfirm,
    subjectType: result.data.subjectType,
    subjectId: result.data.subjectId,
    policy: result.data.policy,
    currentDailySpend: result.data.currentDailySpend,
  };
});

// ============================================
// Agent Management Routes - Step 3
// ============================================

/**
 * Create a new agent
 * POST /agent/create
 */
server.post<{
  Body: {
    name?: string;
    policy?: Partial<SpendPolicy>;
  };
  Headers: { "x-user-id"?: string };
}>("/agent/create", async (request, reply) => {
  const userId = getUserId(request);
  const name = request.body?.name ?? `Agent ${Date.now()}`;
  const policyInput = request.body?.policy ?? {};
  
  // Default agent policy is stricter than user policy
  const policy: SpendPolicy = {
    maxPerActionCents: policyInput.maxPerActionCents ?? 100,     // $1 max per action
    dailyCapCents: policyInput.dailyCapCents ?? 500,             // $5 daily cap
    autoApproveUnderCents: policyInput.autoApproveUnderCents ?? 50, // Auto-approve under $0.50
    requireConfirmAboveCents: policyInput.requireConfirmAboveCents ?? 100, // Confirm over $1
    allowedOrigins: policyInput.allowedOrigins ?? ["*"],
    allowedPaths: policyInput.allowedPaths ?? ["/article/*"],    // Only articles by default
  };
  
  const result = await runWorkflow(createAgent({ userId, name, policy }));
  
  if (!result.ok) {
    return reply.status(errorToStatusCode(result.error)).send(result.error);
  }
  
  return {
    ok: true,
    agentId: result.data.agentId,
    agentToken: result.data.agentToken,
    name: result.data.name,
    policy: result.data.policy,
    curl: `curl -H "Authorization: Bearer ${result.data.agentToken}" http://localhost:4000/article/article-1`,
  };
});

/**
 * List agents for user
 * GET /agent/list
 */
server.get<{
  Headers: { "x-user-id"?: string };
}>("/agent/list", async (request, reply) => {
  const userId = getUserId(request);
  
  const result = await runWorkflow(listAgents(userId));
  
  if (!result.ok) {
    return reply.status(errorToStatusCode(result.error)).send(result.error);
  }
  
  return {
    userId,
    agents: result.data.map(agent => ({
      agentId: agent.agentId,
      name: agent.name,
      policy: agent.policy,
      createdAt: agent.createdAt,
      lastUsedAt: agent.lastUsedAt,
      // Don't expose full token in list, just preview
      tokenPreview: agent.agentToken.slice(0, 12) + "...",
    })),
  };
});

// ============================================
// Start Server
// ============================================

const serverPort = PORT;
const serverHost = HOST;

try {
  await server.listen({ port: serverPort, host: serverHost });
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🔷 Decagon API Server (Step 5)                              ║
║                                                               ║
║   Running at: http://localhost:${serverPort}                          ║
║   Mode: ${USE_SQLITE ? "SQLite (persistent)" : "Mock (in-memory)"}                                  ║
║                                                               ║
║   HTTP 402 Payment Flow:                                      ║
║     GET  /article/:id     → 402 + challenge (no credits)      ║
║                           → 200 + full content (has credits)  ║
║                                                               ║
║   Session Management:                                         ║
║     GET  /credits/balance → Current credit balance            ║
║     POST /pay/verify      → Verify payment, get session       ║
║                                                               ║
║   Policy Management (Step 3):                                 ║
║     GET  /policy          → Get spend policy                  ║
║     POST /policy          → Set spend policy                  ║
║     POST /policy/check    → Check if payment allowed          ║
║                                                               ║
║   Agent Management (Step 3):                                  ║
║     POST /agent/create    → Create agent token                ║
║     GET  /agent/list      → List agents                       ║
║                                                               ║
║   Authorization: Bearer <sessionTokenId|agentToken>           ║
║   User ID: x-user-id header (default: demo-user)              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
