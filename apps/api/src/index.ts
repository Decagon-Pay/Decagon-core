/**
 * Decagon API Server
 * 
 * Fastify HTTP server that serves as the edge layer.
 * Route handlers parse requests, call core workflows, and map results to HTTP responses.
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import { Effect, Exit } from "effect";
import {
  getArticle,
  listArticles,
  createPaymentChallenge,
  mockVerifyPayment,
  MockCapabilities,
} from "@decagon/core";
import type { ApiError, PaymentRequiredResponse } from "@decagon/x402";

// ============================================
// Server Setup
// ============================================

const server = Fastify({
  logger: true,
});

// Enable CORS for frontend
await server.register(cors, {
  origin: ["http://localhost:3000", "http://localhost:3001"],
  methods: ["GET", "POST", "PUT", "DELETE"],
});

// ============================================
// Effect Runtime Helper
// ============================================

/**
 * Run an Effect workflow with mock capabilities and convert to Promise
 */
const runWorkflow = <A, E extends ApiError>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  effect: Effect.Effect<A, E, never> | Effect.Effect<A, E, any>
): Promise<{ ok: true; data: A } | { ok: false; error: E }> =>
  Effect.runPromiseExit(
    Effect.provide(effect as Effect.Effect<A, E, never>, MockCapabilities)
  ).then((exit) => {
    if (Exit.isSuccess(exit)) {
      return { ok: true as const, data: exit.value };
    } else {
      const cause = exit.cause;
      // Extract the error from the cause
      if (cause._tag === "Fail") {
        return { ok: false as const, error: cause.error as E };
      }
      // Unexpected error
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
 * Get article by ID
 * For Step 1: Always returns preview content (200)
 * In Step 2: Will return 402 when payment is required
 */
server.get<{
  Params: { id: string };
}>("/article/:id", async (request, reply) => {
  const { id } = request.params;

  const result = await runWorkflow(getArticle({ articleId: id }));

  if (!result.ok) {
    return reply.status(errorToStatusCode(result.error)).send(result.error);
  }

  return result.data;
});

/**
 * List all articles
 */
server.get("/articles", async (request, reply) => {
  const result = await runWorkflow(listArticles());

  if (!result.ok) {
    return reply.status(errorToStatusCode(result.error)).send(result.error);
  }

  return { articles: result.data };
});

/**
 * Request credits top-up (creates a payment challenge)
 * POST /credits/topup
 */
server.post<{
  Body: { articleId: string };
}>("/credits/topup", async (request, reply) => {
  const { articleId } = request.body ?? { articleId: "article-1" };

  const result = await runWorkflow(createPaymentChallenge({ articleId }));

  if (!result.ok) {
    return reply.status(errorToStatusCode(result.error)).send(result.error);
  }

  // Return the challenge as a PaymentRequiredResponse structure
  const response: PaymentRequiredResponse = {
    status: 402,
    message: "Payment required to access this content",
    challenge: result.data,
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

  return response;
});

/**
 * Verify payment and get receipt + session token
 * POST /pay/verify
 */
server.post<{
  Body: {
    challengeId: string;
    resourceId: string;
    transactionRef?: string;
  };
}>("/pay/verify", async (request, reply) => {
  const { challengeId, resourceId, transactionRef } = request.body ?? {};

  if (!challengeId || !resourceId) {
    return reply.status(400).send({
      _tag: "ValidationError",
      message: "Missing required fields: challengeId, resourceId",
      timestamp: new Date().toISOString(),
      field: "body",
      reason: "Missing required fields",
    });
  }

  // For Step 1, use mock verification that always succeeds
  const result = await runWorkflow(mockVerifyPayment(challengeId, resourceId));

  if (!result.ok) {
    return reply.status(errorToStatusCode(result.error)).send(result.error);
  }

  return {
    success: true,
    receipt: result.data.receipt,
    sessionToken: result.data.sessionToken,
    message: "Payment verified! You now have access to the content.",
  };
});

// ============================================
// Start Server
// ============================================

const PORT = process.env["PORT"] ? parseInt(process.env["PORT"], 10) : 4000;
const HOST = process.env["HOST"] ?? "0.0.0.0";

try {
  await server.listen({ port: PORT, host: HOST });
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🔷 Decagon API Server                                       ║
║                                                               ║
║   Running at: http://localhost:${PORT}                          ║
║                                                               ║
║   Endpoints:                                                  ║
║     GET  /health          - Health check                      ║
║     GET  /articles        - List all articles                 ║
║     GET  /article/:id     - Get article by ID                 ║
║     POST /credits/topup   - Create payment challenge          ║
║     POST /pay/verify      - Verify payment (mock)             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
