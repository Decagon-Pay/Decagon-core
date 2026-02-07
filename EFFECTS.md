# EFFECTS.md — Effectful Architecture Documentation

This document describes the effectful architecture of Decagon, designed to qualify for the **Effectful Programming bounty**.

## Overview

Decagon uses the [Effect](https://effect.website) library to express all business logic as **pure, composable workflows** that:

1. Have no direct side effects
2. Declare their dependencies via the type system
3. Can be tested in isolation with mock implementations
4. Are executed only at the application boundary (API routes)

## Step 2: HTTP 402 Payment Flow

The core flow demonstrates the effectful architecture:

```
GET /article/:id (no auth)
    ↓
Workflow: getArticle
    ↓ (yields to ArticlesStore)
    ↓ (yields to ChallengesStore to create challenge)
    ↓ (fails with PaymentRequiredError)
    ↓
HTTP 402 + PaymentChallenge
    ↓
POST /pay/verify {challengeId, transactionRef, payerAddress}
    ↓
Workflow: verifyPaymentAndIssueSession
    ↓ (yields to ChallengesStore to validate)
    ↓ (yields to PaymentVerifier to verify)
    ↓ (yields to ReceiptsStore to persist)
    ↓
SessionToken {tokenId, credits: 100}
    ↓
GET /article/:id + Authorization: Bearer <tokenId>
    ↓
Workflow: getArticle
    ↓ (yields to ReceiptsStore to check credits)
    ↓ (yields to ReceiptsStore to consume 1 credit)
    ↓
ArticleResponse {hasFullAccess: true, content: "...full..."}
```

## Step 3: Policy Enforcement Flow

Step 3 adds a **policy gate** before payment challenge creation, ensuring users and agents can only spend within configured limits.

```
POST /policy/check {amountCents, path, origin?}
    ↓                   + Authorization: Bearer <agentToken?>
    ↓
Workflow: checkPaymentPolicy
    ↓ (yields to AgentStore to resolve agent)
    ↓ (yields to PolicyStore to get policy)
    ↓ (yields to UsageStore to get daily spend)
    ↓ (calls pure checkPolicy function)
    ↓
PolicyCheckResult {allowed, needsConfirm, currentDailySpend, policy}
    ↓
    ├── If blocked: PolicyViolationError {reason, _tag}
    │
    └── If allowed: Proceed to 402 flow
        ↓
    POST /pay/verify ...
        ↓
    Workflow: recordSpend
        ↓ (yields to UsageStore to add spend)
        ↓
    UsageRecorded {newDailyTotal}
```

### The Policy Gate Pattern

The policy check is a **gate** that sits before the payment challenge is created. This ensures:

1. **Pre-authorization**: Before any payment is attempted, policy is checked
2. **Fail-fast**: Blocked payments never reach the payment infrastructure  
3. **User confirmation**: Large payments can require explicit user confirmation
4. **Agent scoping**: AI agents have stricter limits than human users

### Pure Policy Enforcement

The core policy check is a **pure function** with no effects:

```typescript
// packages/core/src/policy/check-policy.ts

export function checkPolicy(params: CheckPolicyParams): PolicyCheckResult {
  const { policy, amountCents, currentDailySpendCents, path, origin, subjectType, subjectId } = params;

  // Check path allowlist
  if (!pathMatches(path, policy.allowedPaths)) {
    return { allowed: false, error: policyViolation("Path not allowed") };
  }

  // Check origin allowlist  
  if (origin && !originMatches(origin, policy.allowedOrigins)) {
    return { allowed: false, error: policyViolation("Origin not allowed") };
  }

  // Check per-action limit
  if (amountCents > policy.maxPerActionCents) {
    return { allowed: false, error: policyViolation("Exceeds max per action") };
  }

  // Check daily cap
  if (currentDailySpendCents + amountCents > policy.dailyCapCents) {
    return { allowed: false, error: policyViolation("Exceeds daily cap") };
  }

  // Determine if confirmation needed
  const needsConfirm = amountCents >= policy.requireConfirmAboveCents;
  
  return { allowed: true, needsConfirm, policy, currentDailySpend: currentDailySpendCents };
}
```

This pure function is wrapped in an Effect workflow that handles I/O:

```typescript
// packages/core/src/workflows/policy-workflows.ts

export const checkPaymentPolicy = (input: CheckPolicyInput) =>
  Effect.gen(function* () {
    const agentStore = yield* AgentStore;
    const policyStore = yield* PolicyStore;
    const usageStore = yield* UsageStore;
    
    // Resolve subject (agent or user)
    const subject = input.agentToken 
      ? yield* agentStore.getByToken(input.agentToken)
      : { type: "user", id: input.userId, policy: yield* policyStore.get(input.userId) };
    
    // Get current daily spend
    const dailySpend = yield* usageStore.getDailySpendCents(makeSubjectId(subject));
    
    // Pure policy check
    return checkPolicy({
      policy: subject.policy,
      amountCents: input.amountCents,
      currentDailySpendCents: dailySpend,
      path: input.path,
      origin: input.origin,
      subjectType: subject.type,
      subjectId: subject.id,
    });
  });

## Effect Inventory (I/O Boundaries)

All external interactions are modeled as **Effect services** — interfaces that abstract over I/O operations.

### Step 2 Capabilities

| Effect | Purpose | Location | Status |
|--------|---------|----------|--------|
| **ArticlesStore** | Persistence for articles | `packages/core/src/capabilities/articles-store.ts` | Mock |
| **ReceiptsStore** | Persistence for receipts & sessions | `packages/core/src/capabilities/receipts-store.ts` | Mock |
| **ChallengesStore** | Persistence for payment challenges | `packages/core/src/capabilities/challenges-store.ts` | Mock |
| **Clock** | Time operations | `packages/core/src/capabilities/clock.ts` | Mock |
| **IdGen** | Unique ID generation | `packages/core/src/capabilities/id-gen.ts` | Mock |
| **Logger** | Structured logging | `packages/core/src/capabilities/logger.ts` | Mock |
| **PaymentVerifier** | Blockchain verification | `packages/core/src/capabilities/payment-verifier.ts` | Mock |

### Step 3 Capabilities (Policy + Agents)

| Effect | Purpose | Location | Status |
|--------|---------|----------|--------|
| **PolicyStore** | User spend policy persistence | `packages/core/src/capabilities/policy-store.ts` | Mock |
| **AgentStore** | Agent token management | `packages/core/src/capabilities/agent-store.ts` | Mock |
| **UsageStore** | Daily spend tracking | `packages/core/src/capabilities/usage-store.ts` | Mock |

#### PolicyStore

```typescript
export interface PolicyStore {
  readonly getUserPolicy: (userId: string) => Effect.Effect<SpendPolicy, never>;
  readonly setUserPolicy: (userId: string, policy: SpendPolicy) => Effect.Effect<void, never>;
  readonly hasUserPolicy: (userId: string) => Effect.Effect<boolean, never>;
}
```

The PolicyStore manages user-defined spend limits:
- **maxPerActionCents**: Maximum spend per single action
- **dailyCapCents**: Maximum daily spend
- **autoApproveUnderCents**: Auto-approve amounts below this
- **requireConfirmAboveCents**: Require confirmation above this
- **allowedOrigins**: Allowlist of request origins
- **allowedPaths**: Allowlist of resource paths

#### AgentStore

```typescript
export interface AgentStore {
  readonly createAgent: (userId: string, name: string, policy: SpendPolicy) => Effect.Effect<Agent, never>;
  readonly getAgentByToken: (token: string) => Effect.Effect<Agent, ApiError>;
  readonly getAgentById: (agentId: string) => Effect.Effect<Agent, ApiError>;
  readonly listAgentsByUser: (userId: string) => Effect.Effect<readonly Agent[], never>;
  readonly updateLastUsed: (agentId: string) => Effect.Effect<void, ApiError>;
  readonly deleteAgent: (agentId: string) => Effect.Effect<void, ApiError>;
}
```

Agents are scoped tokens with their own policies (often stricter than the user's policy). This enables:
- **Delegation**: Give AI agents limited spending authority
- **Isolation**: Each agent has independent spend tracking
- **Audit**: Track which agent performed which transactions

#### UsageStore

```typescript
export interface UsageStore {
  readonly getDailySpendCents: (subjectId: string) => Effect.Effect<number, never>;
  readonly addSpendCents: (subjectId: string, amountCents: number) => Effect.Effect<number, never>;
  readonly resetDailySpend: (subjectId: string) => Effect.Effect<void, never>;
}
```

The UsageStore tracks daily spend by subject (user or agent):
- Subject ID format: `user:{userId}:{YYYY-MM-DD}` or `agent:{agentId}:{YYYY-MM-DD}`
- Enables daily cap enforcement
- Resets at midnight (not implemented in mock)

### Future Effects (Not Yet Implemented)

| Effect | Purpose | Notes |
|--------|---------|-------|
| **WalletConnector** | User wallet interaction | For signing transactions |
| **ConfigStore** | Application configuration | Environment variables, feature flags |

### Step 4A Capabilities (On-Chain Payments)

| Effect | Purpose | Location | Status |
|--------|---------|----------|--------|
| **ChainConfigService** | Chain configuration (RPC, chainId, payee) | `packages/core/src/capabilities/chain-config.ts` | Mock + Live |
| **PlasmaRpc** | Plasma blockchain JSON-RPC | `packages/core/src/capabilities/plasma-rpc.ts` | Mock + Live |
| **PaymentVerifier** | On-chain transaction verification | `packages/core/src/capabilities/payment-verifier.ts` | Mock + Live |

#### ChainConfigService

```typescript
export interface ChainConfig {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  assetType: "NATIVE" | "ERC20";
  assetSymbol: string;
  payeeAddress: string;
  explorerTxBase: string;
  topupPriceWei: string;
}

export interface ChainConfigService {
  readonly getConfig: () => Effect.Effect<ChainConfig, never>;
}
```

Provides chain-specific configuration for payment verification:
- **chainId**: Plasma Testnet (9746)
- **rpcUrl**: `https://testnet-rpc.plasma.to`
- **payeeAddress**: Merchant wallet address
- **explorerTxBase**: `https://testnet.plasmascan.to/tx/`

#### PlasmaRpc

```typescript
export interface PlasmaRpc {
  readonly getTransaction: (txHash: string) => Effect.Effect<RpcTransaction | null, ApiError>;
  readonly getTransactionReceipt: (txHash: string) => Effect.Effect<RpcTransactionReceipt | null, ApiError>;
  readonly getBlock: (blockNumber: string) => Effect.Effect<RpcBlock | null, ApiError>;
  readonly getBlockNumber: () => Effect.Effect<string, ApiError>;
  readonly getChainId: () => Effect.Effect<string, ApiError>;
}
```

Low-level JSON-RPC client for Plasma blockchain:
- **getTransaction**: Fetch tx by hash (eth_getTransactionByHash)
- **getTransactionReceipt**: Fetch receipt (eth_getTransactionReceipt)
- **getBlock**: Fetch block by number (eth_getBlockByNumber)

#### PaymentVerifier (Extended for Step 4A)

```typescript
export interface VerificationResult {
  valid: boolean;
  verifiedAmount: number;
  verifiedAt: string;
  errorMessage?: string;
  // Step 4A: On-chain fields
  txHash?: string;
  blockNumber?: number;
  amountWei?: string;
  amountNative?: string;
  explorerUrl?: string;
}
```

Enhanced with on-chain transaction details:
- **txHash**: Transaction hash verified
- **blockNumber**: Block number for confirmation
- **explorerUrl**: Link to block explorer

### Live Implementations

Step 4A introduces **live implementations** alongside mocks:

```typescript
// packages/core/src/live/plasma-rpc.ts

export const createLivePlasmaRpc = (rpcUrl: string): PlasmaRpc => ({
  getTransaction: (txHash) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getTransactionByHash",
            params: [txHash],
            id: 1,
          }),
        });
        const json = await response.json();
        return json.result;
      },
      catch: () => ({
        _tag: "InternalError",
        message: "RPC request failed",
        timestamp: new Date().toISOString(),
      }),
    }),
  // ...
});
```

The live PaymentVerifier performs real on-chain verification:

```typescript
export const createLivePaymentVerifier = (config: ChainConfig): PaymentVerifier => ({
  verify: (challenge, proof) =>
    Effect.gen(function* () {
      // 1. Fetch transaction from chain
      const tx = yield* Effect.tryPromise(() => 
        rpcCall("eth_getTransactionByHash", [proof.txHash])
      );

      // 2. Verify recipient matches
      if (tx.to?.toLowerCase() !== challenge.payeeAddress.toLowerCase()) {
        return { valid: false, errorMessage: "Wrong recipient" };
      }

      // 3. Verify amount >= required
      const txValueWei = hexToBigInt(tx.value);
      if (txValueWei < BigInt(challenge.amountWei)) {
        return { valid: false, errorMessage: "Insufficient amount" };
      }

      // 4. Verify receipt shows success
      const receipt = yield* Effect.tryPromise(() =>
        rpcCall("eth_getTransactionReceipt", [proof.txHash])
      );
      if (receipt.status !== "0x1") {
        return { valid: false, errorMessage: "Transaction reverted" };
      }

      // 5. Return enriched result
      return {
        valid: true,
        txHash: proof.txHash,
        blockNumber: hexToNumber(receipt.blockNumber),
        amountWei: tx.value,
        amountNative: (Number(txValueWei) / 1e18).toFixed(6),
        explorerUrl: `${config.explorerTxBase}${proof.txHash}`,
      };
    }),
});
```

### Retry and Timeout Patterns

For on-chain verification, we use Effect's retry and timeout combinators:

```typescript
export const createRetryingPaymentVerifier = (config: ChainConfig) => {
  const base = createLivePaymentVerifier(config);
  
  return {
    verify: (challenge, proof) =>
      base.verify(challenge, proof).pipe(
        Effect.retry(
          Schedule.exponential("500 millis").pipe(
            Schedule.compose(Schedule.recurs(3))
          )
        ),
        Effect.timeout("30 seconds"),
        Effect.catchAll(() =>
          Effect.succeed({
            valid: false,
            errorMessage: "Verification timed out",
          })
        )
      ),
  };
};
```

This demonstrates Effect's composable error handling:
- **Retry**: Exponential backoff (500ms, 1s, 2s) up to 3 times
- **Timeout**: Fail after 30 seconds
- **Fallback**: Return invalid result on failure

## Effect Definitions

Each capability is defined as an **Effect Context Tag** with a service interface:

```typescript
// packages/core/src/capabilities/clock.ts

import { Context, Effect } from "effect";

export interface Clock {
  readonly now: () => Effect.Effect<string, never>;
  readonly futureSeconds: (seconds: number) => Effect.Effect<string, never>;
  readonly futureMinutes: (minutes: number) => Effect.Effect<string, never>;
  readonly futureHours: (hours: number) => Effect.Effect<string, never>;
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

### Workflow: `getArticle` (Step 2)

Uses `Effect.gen` for cleaner generator-style composition:

```typescript
// packages/core/src/workflows/get-article.ts

export const getArticle = (
  input: GetArticleInput
): Effect.Effect<ArticleResponse, ApiError, AllCapabilities> =>
  Effect.gen(function* () {
    const articlesStore = yield* ArticlesStore;
    const article = yield* articlesStore.getById(input.articleId);

    // No session token = return 402
    if (!input.sessionTokenId) {
      return yield* createChallengeAndFail(article);
    }

    return yield* checkSessionAndUnlock(article, input.sessionTokenId);
  });
```

### Workflow: `verifyPaymentAndIssueSession` (Step 2)
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

// Step 3: Policy and Agent mocks with in-memory storage
const policiesDb = new Map<string, SpendPolicy>();
const agentsDb = new Map<string, Agent>();
const agentsByToken = new Map<string, Agent>();
const usageDb = new Map<string, number>();

export const MockPolicyStore = Layer.succeed(
  PolicyStore,
  PolicyStore.of({
    getUserPolicy: (userId) => Effect.sync(() => 
      policiesDb.get(userId) ?? DEFAULT_SPEND_POLICY
    ),
    setUserPolicy: (userId, policy) => Effect.sync(() => {
      policiesDb.set(userId, policy);
    }),
    hasUserPolicy: (userId) => Effect.sync(() => policiesDb.has(userId)),
  })
);

export const MockAgentStore = Layer.succeed(
  AgentStore,
  AgentStore.of({
    createAgent: (userId, name, policy) => Effect.sync(() => {
      const agent: Agent = {
        agentId: `agent_${crypto.randomUUID()}`,
        agentToken: `agt_${crypto.randomUUID()}`,
        userId,
        name,
        policy,
        createdAt: new Date().toISOString(),
      };
      agentsDb.set(agent.agentId, agent);
      agentsByToken.set(agent.agentToken, agent);
      return agent;
    }),
    getAgentByToken: (token) => Effect.sync(() => {
      const agent = agentsByToken.get(token);
      if (!agent) throw new Error("Agent not found");
      return agent;
    }),
    // ...
  })
);

export const MockUsageStore = Layer.succeed(
  UsageStore,
  UsageStore.of({
    getDailySpendCents: (subjectId) => Effect.sync(() => 
      usageDb.get(subjectId) ?? 0
    ),
    addSpendCents: (subjectId, amount) => Effect.sync(() => {
      const current = usageDb.get(subjectId) ?? 0;
      const newTotal = current + amount;
      usageDb.set(subjectId, newTotal);
      return newTotal;
    }),
    resetDailySpend: (subjectId) => Effect.sync(() => {
      usageDb.delete(subjectId);
    }),
  })
);

// Combine all mocks
export const MockCapabilities = Layer.mergeAll(
  MockArticlesStore,
  MockReceiptsStore,
  MockChallengesStore,
  MockClock,
  MockIdGen,
  MockLogger,
  MockPaymentVerifier,
  // Step 3
  MockPolicyStore,
  MockAgentStore,
  MockUsageStore
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
