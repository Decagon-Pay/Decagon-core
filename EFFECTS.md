# EFFECTS.md — Effectful Architecture Documentation

This document describes the effectful architecture of Decagon, designed to qualify for the **Effectful Programming bounty**.

## Overview

Decagon uses the [Effect](https://effect.website) library to express **all** business logic as pure, composable workflows that:

1. Have no direct side effects
2. Declare their dependencies via the type system
3. Can be tested in isolation with mock implementations
4. Are executed only at the application boundary (API route handlers)

Every payment flow — whether unlocking an article or sending a remittance transfer — follows the same effectful pipeline.

---

## HTTP 402 Payment Flow

The core flow demonstrates the architecture:

```
GET /article/:id (no auth)
    ↓
Workflow: getArticle
    ↓ yields ArticlesStore, ChallengesStore, ChainConfigService
    ↓ fails with PaymentRequiredError
    ↓
HTTP 402 + PaymentChallenge
    ↓
POST /pay/verify {challengeId, txHash}
    ↓
Workflow: verifyPaymentAndIssueSession
    ↓ yields ChallengesStore (validate)
    ↓ yields PaymentVerifier (verify on-chain)
    ↓ yields ReceiptsStore (persist)
    ↓
SessionToken {tokenId, credits: 100}
    ↓
GET /article/:id + Authorization: Bearer <tokenId>
    ↓
Workflow: getArticle
    ↓ yields ReceiptsStore (check & consume credits)
    ↓
ArticleResponse {hasFullAccess: true}
```

## Remittance Transfer Flow

Remittance reuses the same primitives — `PaymentChallenge`, `verifyPaymentAndIssueSession`, `Receipt` — with a different `resourceId` prefix:

```
POST /transfer/create {recipientAddress, note?}
    ↓
Workflow: createTransfer
    ↓ yields ChallengesStore, Clock, IdGen, ChainConfigService
    ↓ creates PaymentChallenge with resourceId = "transfer:{recipientAddress}"
    ↓
HTTP 402 + PaymentChallenge (same shape as article challenge)
    ↓
POST /transfer/verify {challengeId, txHash}
    ↓
Workflow: verifyTransfer
    ↓ delegates to verifyPaymentAndIssueSession (same pipeline)
    ↓
Receipt + SessionToken
```

The key insight: `createTransfer` produces a standard `PaymentChallenge`. The `PaymentSheet` UI component doesn't need to know whether it's paying for an article or a remittance — it just resolves the challenge.

---

## Policy Enforcement Flow

A **policy gate** sits before every payment challenge, ensuring users and agents stay within configured limits:

```
POST /policy/check {amountCents, path, origin?}
    ↓ + Authorization: Bearer <agentToken?>
    ↓
Workflow: checkPaymentPolicy
    ↓ yields AgentStore (resolve agent identity)
    ↓ yields PolicyStore (fetch spend policy)
    ↓ yields UsageStore (get daily spend)
    ↓ calls pure checkPolicy() function
    ↓
PolicyCheckResult {allowed, needsConfirm, currentDailySpend}
```

### Pure Policy Check

The core policy logic is a **pure function** — no effects, fully testable:

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

This pure function is wrapped in an Effect workflow that handles I/O:

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

---

## Effect Capability Inventory

All external interactions are modeled as **Effect services** — interfaces that abstract over I/O.

### Core Capabilities

| Capability | Purpose | Mock | Live |
|------------|---------|------|------|
| **ArticlesStore** | Article CRUD | ✅ In-memory | — |
| **ReceiptsStore** | Receipts + sessions | ✅ In-memory | ✅ SQLite |
| **ChallengesStore** | Payment challenges | ✅ In-memory | — (short-lived) |
| **Clock** | Time operations | ✅ `Date.now()` | — |
| **IdGen** | Unique ID generation | ✅ Counter-based | — |
| **Logger** | Structured logging | ✅ Console | — |
| **PaymentVerifier** | On-chain tx verification | ✅ Always-valid | ✅ RPC |

### Policy & Agent Capabilities

| Capability | Purpose | Mock | Live |
|------------|---------|------|------|
| **PolicyStore** | User spend policies | ✅ In-memory | ✅ SQLite |
| **AgentStore** | Scoped agent tokens | ✅ In-memory | ✅ SQLite |
| **UsageStore** | Daily spend tracking | ✅ In-memory | ✅ SQLite |

### Chain Integration Capabilities

| Capability | Purpose | Mock | Live |
|------------|---------|------|------|
| **ChainConfigService** | Chain config (RPC, chainId, payee) | ✅ Env vars | — |
| **PlasmaRpc** | Plasma JSON-RPC client | ✅ Empty returns | ✅ fetch-based |

---

## Effect Definitions

Each capability is defined as an **Effect Context Tag**:

```typescript
import { Context, Effect } from "effect";

export interface Clock {
  readonly now: () => Effect.Effect<string, never>;
  readonly futureMinutes: (m: number) => Effect.Effect<string, never>;
  readonly isPast: (iso: string) => Effect.Effect<boolean, never>;
}

export const Clock = Context.GenericTag<Clock>("@decagon/core/Clock");
```

### Key Principles

1. **All methods return Effects** — Even `now()` returns `Effect.Effect<string>`, not `string`.
2. **Error types are explicit** — `Effect.Effect<Article, ApiError>` makes failures visible.
3. **No implementation details** — Interfaces define *what*, not *how*.

---

## Pure Workflows

All business logic lives in `packages/core/src/workflows/` as pure Effect pipelines.

### `getArticle`

```typescript
export const getArticle = (input: GetArticleInput) =>
  Effect.gen(function* () {
    const articlesStore = yield* ArticlesStore;
    const article = yield* articlesStore.getById(input.articleId);
    if (!input.sessionTokenId) return yield* createChallengeAndFail(article);
    return yield* checkSessionAndUnlock(article, input.sessionTokenId);
  });
```

### `verifyPaymentAndIssueSession`

```typescript
export const verifyPaymentAndIssueSession = (input: VerifyPaymentInput) =>
  Effect.gen(function* () {
    const receiptsStore = yield* ReceiptsStore;
    const challengesStore = yield* ChallengesStore;
    const paymentVerifier = yield* PaymentVerifier;

    // Step 1: Idempotency — if receipt already exists for this txRef, return it
    const existing = yield* receiptsStore.getReceiptByTxRef(txRef);
    if (existing) return rehydrateSession(existing);

    // Step 2: Validate challenge (not expired, not already paid)
    const challenge = yield* challengesStore.get(input.challengeId);

    // Step 3: Double-spend guard on txRef
    const isUsed = yield* paymentVerifier.isTransactionUsed(txRef);

    // Step 4: Verify on-chain (or mock)
    const result = yield* paymentVerifier.verify(challenge, proof);

    // Step 5: Mark paid + used (atomically)
    yield* challengesStore.markPaid(challenge.challengeId);
    yield* paymentVerifier.markTransactionUsed(txRef);

    // Step 6: Build receipt + session
    yield* receiptsStore.saveReceipt(receipt);
    yield* receiptsStore.saveSession(sessionToken);

    return { receipt, sessionToken };
  });
```

### `createTransfer`

```typescript
export const createTransfer = (input: CreateTransferInput) =>
  Effect.gen(function* () {
    const idGen = yield* IdGen;
    const clock = yield* Clock;
    const challengesStore = yield* ChallengesStore;
    const chainConfig = yield* ChainConfigService;
    const config = yield* chainConfig.getConfig();

    const challenge: PaymentChallenge = {
      challengeId: yield* idGen.challengeId(),
      resourceId: `transfer:${input.recipientAddress}`,
      // ... same shape as article challenge
    };

    yield* challengesStore.save(challenge);
    return { challenge, recipientAddress: input.recipientAddress, note: input.note };
  });
```

---

## UI SDK Boundary

The `@decagon/ui` package sits **outside** the Effect boundary. It consumes `PaymentChallenge` objects (plain JSON from API responses) and calls API endpoints to verify payments.

```
┌───────────────────────────────┐
│        @decagon/ui            │  React (client-side)
│  PaymentSheet component       │  No Effect dependency
│  useDecagonPayment hook       │  Calls /pay/verify or /transfer/verify
└───────────────┬───────────────┘
                │ fetch()
                ▼
┌───────────────────────────────┐
│        apps/api               │  Fastify (server-side)
│  runWorkflow() boundary       │  Effect.provide(workflow, Capabilities)
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│        @decagon/core          │  Pure Effect workflows
│  getArticle, createTransfer,  │  No HTTP, no fetch, no DOM
│  verifyPaymentAndIssueSession │
└───────────────────────────────┘
```

The `PaymentSheet` component accepts a `config` prop with `apiBase`, `plasmaChainId`, etc. — keeping it decoupled from any specific deployment. The `purpose` prop (`"remittance"` or default) adapts success messages and labels.

---

## Runtime Execution

Effects are executed **only** at the API boundary:

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

### Capability Layer Selection

```typescript
const SqliteCapabilities = Layer.mergeAll(
  MockArticlesStore,        // Static data
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

---

## On-Chain Verification

The live `PaymentVerifier` performs real blockchain verification with Effect's retry and timeout:

```typescript
// packages/core/src/live/plasma-rpc.ts

const verifyOnChain = (challenge, proof) =>
  Effect.gen(function* () {
    const rpc = yield* PlasmaRpc;
    const tx = yield* rpc.getTransaction(proof.txHash);
    // Verify recipient, amount, receipt status
    const receipt = yield* rpc.getTransactionReceipt(proof.txHash);
    return { valid: receipt.status === "0x1", txHash: proof.txHash, ... };
  }).pipe(
    Effect.retry(Schedule.exponential("500 millis").pipe(Schedule.compose(Schedule.recurs(3)))),
    Effect.timeout("30 seconds"),
    Effect.catchAll(() => Effect.succeed({ valid: false, errorMessage: "Verification timed out" }))
  );
```

---

## Mock Implementations

For development and testing, mock implementations are provided in `packages/core/src/mocks/`:

```typescript
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
  MockChainConfig,
  MockPlasmaRpc,
);
```

Each mock uses `Layer.succeed` to provide a concrete implementation:

```typescript
export const MockClock = Layer.succeed(Clock, Clock.of({
  now: () => Effect.sync(() => new Date().toISOString()),
  isPast: (iso) => Effect.sync(() => new Date(iso).getTime() < Date.now()),
  // ...
}));
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        HTTP Request                              │
│              GET /article/123  or  POST /transfer/create         │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Route Handler (apps/api)                    │
│   Parse request → Create Effect → Run with Capabilities → Reply │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Pure Effect Workflow (packages/core)             │
│   Effect.Effect<Response, ApiError, Capability1 | Capability2>   │
│   No direct I/O · All deps in type signature · Composable        │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Capability Layer (Mock or SQLite)                │
│   Layer.mergeAll(Store1, Store2, ...) → provides all services    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Benefits

| Principle | Implementation |
|-----------|----------------|
| Pure core | All workflows in `packages/core/src/workflows/` |
| Explicit effects | Capability interfaces in `packages/core/src/capabilities/` |
| Dependency injection | Effect's `Context` and `Layer` system |
| Type-safe errors | `ApiError` discriminated union, explicit in signatures |
| Runtime at boundary | `Effect.runPromiseExit` only in API route handlers |
| Reusable verticals | Remittance reuses article's verify pipeline and PaymentSheet |
| UI decoupled from Effects | `@decagon/ui` is plain React — no Effect dependency |
