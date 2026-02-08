# How Decagon Uses Effect

Decagon's entire backend is built with [Effect](https://effect.website). This document explains why we chose it, how it shapes the codebase, and why it makes a real difference for a payment product.

---

## Why Effect?

Payments are high-stakes. A bug in transaction verification or session issuance can mean lost money. We needed a way to write business logic that is:

- **Provably correct at the type level.** Every workflow declares exactly what services it needs and what errors it can produce. If the types compile, the wiring is right.
- **Testable without infrastructure.** We can run the full payment verification pipeline against in-memory mocks with zero setup. No databases, no RPC nodes, no wallets.
- **Impossible to accidentally skip a step.** The type system forces you to provide every dependency. You literally cannot call `verifyPaymentAndIssueSession` without handing it a `ChallengesStore`, a `PaymentVerifier`, and a `ReceiptsStore`.

Effect gives us all of this through its `Context`, `Layer`, and generator-based `Effect.gen` patterns.

---

## How It Works in Practice

### Every side effect is a declared dependency

Nothing in our core package touches a database, makes a network call, or reads the clock directly. Instead, each external interaction is modeled as a **capability interface**:

```typescript
import { Context, Effect } from "effect";

export interface Clock {
  readonly now: () => Effect.Effect<string, never>;
  readonly futureMinutes: (m: number) => Effect.Effect<string, never>;
  readonly isPast: (iso: string) => Effect.Effect<boolean, never>;
}

export const Clock = Context.GenericTag<Clock>("@decagon/core/Clock");
```

Even something as simple as "what time is it?" goes through this interface. That means in tests we can freeze time, skip forward, or simulate expiration without touching `Date.now()`.

### Workflows are pure pipelines

All business logic lives in `packages/core/src/workflows/`. Here is the article unlock flow:

```typescript
export const getArticle = (input: GetArticleInput) =>
  Effect.gen(function* () {
    const articlesStore = yield* ArticlesStore;
    const article = yield* articlesStore.getById(input.articleId);
    if (!input.sessionTokenId) return yield* createChallengeAndFail(article);
    return yield* checkSessionAndUnlock(article, input.sessionTokenId);
  });
```

This workflow reads like normal code, but nothing actually happens until it is executed. The `yield*` calls are just declaring "I need this service." The real implementation (SQLite, in-memory, whatever) gets provided later at the boundary.

### One verify pipeline, multiple products

This is where Effect really shines for us. The payment verification workflow handles idempotency, challenge validation, double-spend protection, on-chain verification, and session issuance:

```typescript
export const verifyPaymentAndIssueSession = (input: VerifyPaymentInput) =>
  Effect.gen(function* () {
    const receiptsStore = yield* ReceiptsStore;
    const challengesStore = yield* ChallengesStore;
    const paymentVerifier = yield* PaymentVerifier;

    // 1. Idempotency: if receipt already exists for this txRef, return it
    const existing = yield* receiptsStore.getReceiptByTxRef(txRef);
    if (existing) return rehydrateSession(existing);

    // 2. Validate challenge (not expired, not already paid)
    const challenge = yield* challengesStore.get(input.challengeId);

    // 3. Double-spend guard on txRef
    const isUsed = yield* paymentVerifier.isTransactionUsed(txRef);

    // 4. Verify on-chain (or mock)
    const result = yield* paymentVerifier.verify(challenge, proof);

    // 5. Mark paid + used atomically
    yield* challengesStore.markPaid(challenge.challengeId);
    yield* paymentVerifier.markTransactionUsed(txRef);

    // 6. Build receipt + session
    yield* receiptsStore.saveReceipt(receipt);
    yield* receiptsStore.saveSession(sessionToken);

    return { receipt, sessionToken };
  });
```

Both the **article paywall** and the **remittance transfer** use this exact same pipeline. A transfer just produces a `PaymentChallenge` with a different `resourceId` prefix (`transfer:0x...` instead of `article:article-1`). The verify workflow does not care what was purchased. It just validates the challenge and issues a session.

This is not code reuse by coincidence. Effect's type system guarantees that any workflow requiring `ChallengesStore | PaymentVerifier | ReceiptsStore` will work with any product vertical that produces a standard `PaymentChallenge`.

---

## The Capability System

Every external interaction in Decagon is modeled as a service interface. At startup, we pick real or mock implementations and wire them together using Effect's `Layer` system.

### All Capabilities

| Capability | What it does | Mock | Live |
|------------|-------------|------|------|
| `ArticlesStore` | Article CRUD | In-memory | n/a |
| `ReceiptsStore` | Receipts + sessions | In-memory | SQLite |
| `ChallengesStore` | Payment challenges | In-memory | n/a (short-lived) |
| `PolicyStore` | User spend policies | In-memory | SQLite |
| `AgentStore` | Scoped agent tokens | In-memory | SQLite |
| `UsageStore` | Daily spend tracking | In-memory | SQLite |
| `Clock` | Time operations | `Date.now()` | n/a |
| `IdGen` | Unique ID generation | Counter-based | n/a |
| `Logger` | Structured logging | Console | n/a |
| `PaymentVerifier` | On-chain tx verification | Always-valid | RPC |
| `ChainConfigService` | Chain config (RPC, chainId, payee) | Env vars | n/a |
| `PlasmaRpc` | Plasma JSON-RPC client | Empty returns | fetch-based |

In development, everything runs against mocks. In production, we swap in SQLite stores and a real RPC verifier. The workflows themselves never change.

```typescript
const SqliteCapabilities = Layer.mergeAll(
  MockArticlesStore,        // Static data, no need for DB
  LiveReceiptsStore,        // SQLite
  MockChallengesStore,      // Short-lived, in-memory is fine
  LivePolicyStore,          // SQLite
  LiveAgentStore,           // SQLite
  LiveUsageStore,           // SQLite
  MockClock,                // Stateless
  MockIdGen,                // Stateless
  MockLogger,               // Console
  MockPaymentVerifier,      // TODO: wire live RPC verifier
  MockChainConfig,          // Config from env
  MockPlasmaRpc,            // TODO: wire live RPC
);

const Capabilities = USE_SQLITE ? SqliteCapabilities : MockCapabilities;
```

This is powerful. We can run the entire API with zero external dependencies for local development, then flip `USE_SQLITE=true` and everything persists to disk. The business logic does not know the difference.

---

## The Boundary: Where Effects Actually Run

Effects never run inside the core package. They only execute at the API boundary, where Fastify route handlers provide real implementations:

```typescript
// apps/api/src/index.ts
const runWorkflow = <A, E extends ApiError>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromiseExit(Effect.provide(effect, Capabilities)).then((exit) => {
    if (Exit.isSuccess(exit)) return { ok: true, data: exit.value };
    return { ok: false, error: exit.cause._tag === "Fail" ? exit.cause.error : internalError() };
  });

// Route handler
server.get("/article/:id", async (request, reply) => {
  const result = await runWorkflow(getArticle({ articleId: id, sessionTokenId }));
  if (!result.ok) return reply.status(errorToStatusCode(result.error)).send(result.error);
  return result.data;
});
```

`runWorkflow` is the single point where the Effect world meets the HTTP world. It provides all capabilities, runs the effect, and converts the result into an HTTP response. Every route handler follows this same pattern.

---

## Policy Enforcement

A policy gate sits before every payment, ensuring users and agents stay within configured limits. The core policy logic is a **pure function** with no effects at all:

```typescript
// packages/core/src/policy/check-policy.ts
export function checkPolicy(params: CheckPolicyParams): PolicyCheckResult {
  // 1. Check path allowlist
  // 2. Check origin allowlist
  // 3. Check per-action limit
  // 4. Check daily cap
  // 5. Determine if confirmation needed
  return { allowed: true, needsConfirm, policy, currentDailySpend };
}
```

This pure function is wrapped in an Effect workflow that fetches the data it needs:

```typescript
export const checkPaymentPolicy = (input) =>
  Effect.gen(function* () {
    const agentStore = yield* AgentStore;
    const policyStore = yield* PolicyStore;
    const usageStore = yield* UsageStore;
    const dailySpend = yield* usageStore.getDailySpendCents(subjectId, dayKey);
    return checkPolicy({ policy, amountCents, currentDailySpendCents: dailySpend, ... });
  });
```

Pure logic stays pure. I/O stays at the edges. This makes the policy engine trivially testable: just call `checkPolicy()` with different inputs and assert the output.

---

## On-Chain Verification with Retry and Timeout

Blockchain RPC calls are unreliable. Effect gives us composable retry and timeout strategies out of the box:

```typescript
const verifyOnChain = (challenge, proof) =>
  Effect.gen(function* () {
    const rpc = yield* PlasmaRpc;
    const tx = yield* rpc.getTransaction(proof.txHash);
    const receipt = yield* rpc.getTransactionReceipt(proof.txHash);
    return { valid: receipt.status === "0x1", txHash: proof.txHash, ... };
  }).pipe(
    Effect.retry(Schedule.exponential("500 millis").pipe(Schedule.compose(Schedule.recurs(3)))),
    Effect.timeout("30 seconds"),
    Effect.catchAll(() => Effect.succeed({ valid: false, errorMessage: "Verification timed out" }))
  );
```

Three retries with exponential backoff, a 30-second timeout, and a graceful fallback. All composed declaratively, no try/catch nesting, no manual timer logic.

---

## The UI Stays Outside Effect

The `@decagon/ui` React package has **zero dependency on Effect**. It consumes `PaymentChallenge` objects (plain JSON from the API) and calls REST endpoints to verify payments. This is intentional:

```
@decagon/ui (React)          Plain fetch() calls
       |
       v
apps/api (Fastify)           runWorkflow() boundary
       |
       v
@decagon/core (Effect)       Pure workflows, no HTTP, no DOM
```

The `PaymentSheet` component works the same whether it is paying for an article or a remittance transfer. It does not know or care about Effect. It just resolves whatever `PaymentChallenge` the server hands it.

---

## What This Gets Us

| What | How |
|------|-----|
| **Zero-setup local dev** | All mocks are provided via `Layer.mergeAll`. Run `pnpm dev` and the full API works with no database or RPC node. |
| **Confident refactoring** | If you change a capability interface, the compiler tells you every workflow that needs updating. Nothing silently breaks. |
| **One payment pipeline for everything** | Articles and remittance both produce a `PaymentChallenge` and flow through the same `verifyPaymentAndIssueSession` workflow. Adding a new product vertical means writing one new `create` workflow. |
| **Type-safe error handling** | Every workflow declares its error types. `Effect.Effect<Article, PaymentRequiredError | NotFoundError>` means the route handler knows exactly what can go wrong. |
| **Composable resilience** | Retry, timeout, and fallback for on-chain verification are one-liners, not nested try/catch blocks. |
| **Clean testing boundary** | Business logic is tested with mock capabilities. API routes are tested with real HTTP. Neither test needs the other's infrastructure. |

---

## Project Structure

```
Decagon-core/
  packages/
    x402/                HTTP 402 protocol types (shared between client and server)
    core/
      capabilities/      Effect service interfaces (the I/O boundaries)
      workflows/         Pure Effect pipelines (all business logic)
      policy/            Pure policy check function (no effects)
      mocks/             In-memory mock implementations for dev and test
      live/              Real SQLite and RPC implementations for production
    ui/                  React PaymentSheet SDK (no Effect dependency)
  apps/
    api/                 Fastify server, the runWorkflow() boundary
    web/                 Next.js 14 frontend
```

---

## Summary

Effect is not just a library we dropped in. It is the architecture. Every payment workflow, every capability boundary, every mock-vs-live swap, and every error path is expressed through Effect's type system. The result is a payment backend where the compiler catches wiring mistakes, where adding a new product vertical is a single workflow file, and where local development works identically to production without any external dependencies.
