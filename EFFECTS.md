# EFFECTS.md — Effectful Architecture Documentation

This document describes the effectful architecture of Decagon, designed to qualify for the **Effectful Programming bounty**.

## Overview

Decagon uses the [Effect](https://effect.website) library to express all business logic as **pure, composable workflows** that:

1. Have no direct side effects
2. Declare their dependencies via the type system
3. Can be tested in isolation with mock implementations
4. Are executed only at the application boundary (API routes)

## Effect Inventory (I/O Boundaries)

All external interactions are modeled as **Effect services** — interfaces that abstract over I/O operations.

| Effect | Purpose | Location | Status |
|--------|---------|----------|--------|
| **ArticlesStore** | Persistence for articles | `packages/core/src/capabilities/articles-store.ts` | Mock |
| **ReceiptsStore** | Persistence for receipts & sessions | `packages/core/src/capabilities/receipts-store.ts` | Mock |
| **Clock** | Time operations | `packages/core/src/capabilities/clock.ts` | Mock |
| **IdGen** | Unique ID generation | `packages/core/src/capabilities/id-gen.ts` | Mock |
| **Logger** | Structured logging | `packages/core/src/capabilities/logger.ts` | Mock |
| **PaymentVerifier** | Blockchain verification | `packages/core/src/capabilities/payment-verifier.ts` | Mock |

### Future Effects (Not Yet Implemented)

| Effect | Purpose | Notes |
|--------|---------|-------|
| **PlasmaRpc** | Plasma blockchain RPC | Will verify on-chain transactions |
| **WalletConnector** | User wallet interaction | For signing transactions |
| **ConfigStore** | Application configuration | Environment variables, feature flags |

## Effect Definitions

Each capability is defined as an **Effect Context Tag** with a service interface:

```typescript
// packages/core/src/capabilities/clock.ts

import { Context, Effect } from "effect";

export interface Clock {
  readonly now: () => Effect.Effect<string, never>;
  readonly futureSeconds: (seconds: number) => Effect.Effect<string, never>;
  readonly isPast: (isoTimestamp: string) => Effect.Effect<boolean, never>;
}

export const Clock = Context.GenericTag<Clock>("@decagon/core/Clock");
```

### Key Principles

1. **All methods return Effects** — Even simple operations like `now()` return `Effect.Effect<string, never>` rather than `string`. This ensures the operation is only executed when the Effect is run.

2. **Error types are explicit** — Capabilities that can fail specify their error type: `Effect.Effect<Article, ApiError>`. This makes error handling explicit and type-safe.

3. **No implementation details** — Interfaces define *what* operations are available, not *how* they're implemented. This allows swapping implementations (mock → real) without changing workflows.

## Pure Core (Workflows)

All business logic lives in `packages/core/src/workflows/` as **pure Effect workflows**.

### Workflow: `getArticle`

```typescript
// packages/core/src/workflows/get-article.ts

export const getArticle = (
  input: GetArticleInput
): Effect.Effect<
  ArticleResponse,      // Success type
  ApiError,             // Error type
  ArticlesStore | Logger // Required capabilities
> =>
  pipe(
    Effect.flatMap(Logger, (logger) => 
      logger.info("Getting article", { articleId: input.articleId })
    ),
    Effect.flatMap(() =>
      Effect.flatMap(ArticlesStore, (store) => store.getById(input.articleId))
    ),
    Effect.map((article): ArticleResponse => ({
      article,
      hasFullAccess: false,
      content: article.preview,
    }))
  );
```

### Workflow: `createPaymentChallenge`

```typescript
// packages/core/src/workflows/create-payment-challenge.ts

export const createPaymentChallenge = (
  input: CreatePaymentChallengeInput
): Effect.Effect<
  PaymentChallenge,
  ApiError,
  ArticlesStore | Clock | IdGen | Logger
> =>
  pipe(
    Effect.flatMap(Logger, (logger) =>
      logger.info("Creating payment challenge", { articleId: input.articleId })
    ),
    Effect.flatMap(() =>
      Effect.flatMap(ArticlesStore, (store) => store.getById(input.articleId))
    ),
    Effect.flatMap((article: Article) =>
      Effect.all({
        article: Effect.succeed(article),
        challengeId: Effect.flatMap(IdGen, (idGen) => idGen.challengeId()),
        createdAt: Effect.flatMap(Clock, (clock) => clock.now()),
        expiresAt: Effect.flatMap(Clock, (clock) => clock.futureSeconds(600)),
      })
    ),
    Effect.map(({ article, challengeId, createdAt, expiresAt }): PaymentChallenge => ({
      challengeId,
      resourceId: article.id,
      amountRequired: article.price,
      currency: article.currency,
      description: `Unlock: ${article.title}`,
      payTo: PAYMENT_RECIPIENT,
      expiresAt,
      createdAt,
    }))
  );
```

### Workflow: `verifyPaymentAndIssueSession`

```typescript
// packages/core/src/workflows/verify-payment.ts

export const verifyPaymentAndIssueSession = (
  input: VerifyPaymentInput
): Effect.Effect<
  VerifyPaymentOutput,
  ApiError,
  ReceiptsStore | Clock | IdGen | Logger | PaymentVerifier
> =>
  pipe(
    // Check challenge expiration
    Effect.flatMap(Clock, (clock) => clock.isPast(input.challenge.expiresAt)),
    Effect.flatMap((isExpired) =>
      isExpired
        ? Effect.fail(invalidPayment(input.challenge.challengeId, "Challenge expired"))
        : Effect.succeed(undefined)
    ),
    
    // Verify payment
    Effect.flatMap(() =>
      Effect.flatMap(PaymentVerifier, (verifier) =>
        verifier.verify(input.challenge, input.proof)
      )
    ),
    
    // Generate receipt and session
    Effect.flatMap((result) =>
      Effect.all({
        receiptId: Effect.flatMap(IdGen, (idGen) => idGen.receiptId()),
        sessionTokenId: Effect.flatMap(IdGen, (idGen) => idGen.sessionTokenId()),
        now: Effect.flatMap(Clock, (clock) => clock.now()),
        // ... construct Receipt and SessionToken
      })
    ),
    
    // Persist to store
    Effect.tap(({ receipt }) =>
      Effect.flatMap(ReceiptsStore, (store) => store.saveReceipt(receipt))
    )
  );
```

## Runtime Execution

Effects are executed **only at the API boundary** — never inside the core.

### Route Handler Pattern

```typescript
// apps/api/src/index.ts

import { Effect, Exit } from "effect";
import { getArticle, MockCapabilities } from "@decagon/core";

// Run workflow with capabilities
const runWorkflow = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromiseExit(Effect.provide(effect, MockCapabilities));

// Route handler
server.get("/article/:id", async (request, reply) => {
  const result = await runWorkflow(getArticle({ articleId: request.params.id }));
  
  if (Exit.isSuccess(result)) {
    return result.value;
  } else {
    return reply.status(errorToStatusCode(result.cause)).send(result.cause);
  }
});
```

### Key Points

1. **Workflows are values** — `getArticle({ articleId: "123" })` returns an `Effect` value, not a result. No computation happens until `Effect.runPromise*` is called.

2. **Capabilities are injected** — `Effect.provide(effect, MockCapabilities)` supplies all required services. In production, this would be `RealCapabilities`.

3. **Errors are type-safe** — The `Exit` type tells us exactly what errors are possible, and we handle them explicitly.

## Mock Implementations

For development and testing, mock implementations are provided in `packages/core/src/mocks/`:

```typescript
// packages/core/src/mocks/index.ts

export const MockClock = Layer.succeed(
  Clock,
  Clock.of({
    now: () => Effect.sync(() => new Date().toISOString()),
    futureSeconds: (seconds: number) =>
      Effect.sync(() => new Date(Date.now() + seconds * 1000).toISOString()),
    isPast: (isoTimestamp: string) =>
      Effect.sync(() => new Date(isoTimestamp).getTime() < Date.now()),
  })
);

// Combine all mocks
export const MockCapabilities = Layer.mergeAll(
  MockArticlesStore,
  MockReceiptsStore,
  MockClock,
  MockIdGen,
  MockLogger,
  MockPaymentVerifier
);
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        HTTP Request                             │
│                    GET /article/123                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Route Handler                              │
│                    (apps/api)                                   │
│                                                                 │
│   • Parse request params                                        │
│   • Create Effect workflow                                      │
│   • Run with capabilities                                       │
│   • Map result to HTTP response                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Pure Effect Workflow                         │
│                   (packages/core)                               │
│                                                                 │
│   Effect.Effect<ArticleResponse, ApiError, ArticlesStore>       │
│                                                                 │
│   • No direct I/O                                               │
│   • All dependencies in type signature                          │
│   • Composition via pipe/flatMap                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Capability Layer                             │
│                   (Mock or Real)                                │
│                                                                 │
│   MockCapabilities = Layer.mergeAll(                            │
│     MockArticlesStore,                                          │
│     MockReceiptsStore,                                          │
│     MockClock,                                                  │
│     MockIdGen,                                                  │
│     MockLogger,                                                 │
│     MockPaymentVerifier                                         │
│   )                                                             │
└─────────────────────────────────────────────────────────────────┘
```

## Benefits of This Architecture

### 1. Testability

Workflows can be tested with controlled inputs:

```typescript
const TestClock = Layer.succeed(Clock, {
  now: () => Effect.succeed("2026-01-01T00:00:00Z"),
  isPast: () => Effect.succeed(false),
  // ...
});

// Test with deterministic time
const result = await Effect.runPromise(
  Effect.provide(createPaymentChallenge({ articleId: "1" }), TestClock)
);
```

### 2. Composability

Workflows compose naturally:

```typescript
const fullPurchaseFlow = pipe(
  createPaymentChallenge({ articleId }),
  Effect.flatMap((challenge) => verifyPayment({ challenge, proof })),
  Effect.flatMap(() => getArticle({ articleId, sessionTokenId }))
);
```

### 3. Type Safety

The type system enforces that all dependencies are provided:

```typescript
// Error: Type 'Effect<..., ArticlesStore | Clock | IdGen | Logger>' 
//        is not assignable to type 'Effect<..., never>'
Effect.runPromise(createPaymentChallenge({ articleId: "1" }));

// ✓ Correct: Provide all capabilities
Effect.runPromise(
  Effect.provide(createPaymentChallenge({ articleId: "1" }), MockCapabilities)
);
```

### 4. Separation of Concerns

- **Protocol types** (`@decagon/x402`) — No logic, just TypeScript types
- **Business logic** (`@decagon/core`) — Pure workflows, no HTTP
- **HTTP layer** (`apps/api`) — Only parsing/mapping, no logic

## Future Enhancements

### Real PaymentVerifier

When integrating with Plasma:

```typescript
const PlasmaPaymentVerifier = Layer.effect(
  PaymentVerifier,
  Effect.gen(function* () {
    const rpc = yield* PlasmaRpc;
    
    return PaymentVerifier.of({
      verify: (challenge, proof) =>
        Effect.gen(function* () {
          const tx = yield* rpc.getTransaction(proof.transactionRef);
          const valid = tx.to === challenge.payTo && tx.amount >= challenge.amountRequired;
          return { valid, verifiedAmount: tx.amount, verifiedAt: tx.timestamp };
        }),
      // ...
    });
  })
);
```

### Real Database

Replace mock in-memory stores with SQLite:

```typescript
const SqliteArticlesStore = Layer.effect(
  ArticlesStore,
  Effect.gen(function* () {
    const db = yield* SqliteConnection;
    
    return ArticlesStore.of({
      getById: (id) =>
        Effect.tryPromise(() => db.query("SELECT * FROM articles WHERE id = ?", [id])),
      // ...
    });
  })
);
```

## Summary

Decagon's effectful architecture provides:

| Principle | Implementation |
|-----------|----------------|
| Pure core | All workflows in `packages/core/src/workflows/` |
| Explicit effects | Capability interfaces in `packages/core/src/capabilities/` |
| Dependency injection | Effect's `Context` and `Layer` system |
| Type-safe errors | `ApiError` union type, explicit in signatures |
| Runtime at boundary | `Effect.runPromise*` only in route handlers |

This architecture makes the codebase **testable**, **maintainable**, and **type-safe** — exactly what's needed for a production-grade payment system.
