/**
 * Mock Implementations
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
    premiumContent: `The complete guide to implementing micro-payments on your platform.

For two decades the web has been funded by a fragile duopoly: advertising and subscriptions. Advertising incentivises engagement farming, while subscriptions create "all or nothing" bundles that leave most users priced out. HTTP 402 — Payment Required — was reserved in the original HTTP spec precisely for a third option, but the payment rails never materialised.

Until now. With sub-cent transaction fees on Layer 2 chains like Plasma, a publisher can charge $0.10 for an article and the reader will still pay less than the cognitive cost of dismissing a cookie banner. The economics flip: creators are paid per piece of value, and readers never see an ad again.

Implementation is straightforward. Your server checks for a valid session token on each request. If the token is absent or has insufficient credits, it returns 402 with a JSON payment challenge containing the amount, recipient address, and chain ID. The client renders a payment sheet, the user taps "Pay", and a standard eth_sendTransaction call settles on Plasma in under two seconds. The server verifies the transaction, mints credits, and returns the content.

We've seen early adopters achieve 8–12% conversion rates on paywalled articles — roughly 3× the industry average for soft paywalls. The key insight is that micro-payments feel cheap enough to be impulsive but expensive enough to signal quality.

Best practices for maximising conversion include: keeping the payment sheet under three clicks, showing a blurred preview of premium content, offering credit bundles to reduce per-article friction, and displaying a clear receipt with an on-chain explorer link so users feel confident they got what they paid for.`,
    price: 50,
    currency: "USD",
    publishedAt: "2026-01-15T10:00:00Z",
    readTimeMinutes: 8,
    tags: ["web3", "payments", "monetization"],
  },
  {
    id: "article-2",
    title: "HTTP 402: The Forgotten Status Code",
    author: "Marcus Williams",
    preview: "When HTTP status codes were designed, 402 was reserved for 'Payment Required', but it was never properly defined. Decades later, we finally have the technology to make it useful...",
    premiumContent: `A deep dive into the history of HTTP 402, from its origins in RFC 2616 to modern implementations.

When Tim Berners-Lee and the early IETF working group drafted the original HTTP status codes in the early 1990s, they included a curious placeholder: 402 Payment Required. The RFC noted it was "reserved for future use" — an acknowledgement that the web would one day need a native payment layer, but that the technology wasn't ready.

For thirty years 402 gathered dust. Credit card networks couldn't economically process payments below $1. PayPal required accounts. Bitcoin was too volatile. Every attempt to build "pay for the web" failed because the payment instrument was worse than the alternative (ads).

Three things changed simultaneously: (1) stablecoins pegged to the dollar eliminated price volatility, (2) Layer 2 rollups like Plasma reduced fees to fractions of a cent, and (3) browser wallets like MetaMask became mainstream enough that "connect wallet" is no longer alien. Suddenly, 402 makes sense.

The modern 402 flow works like this: the server returns a JSON body alongside the 402 status containing a PaymentChallenge object. This object specifies the payee address, amount in both fiat and native token, chain ID, and an expiry timestamp. The client parses this challenge, presents a confirmation UI, and sends a standard Ethereum transaction. After confirmation, the client POSTs the transaction hash back to the server, which verifies it on-chain and grants access.

Implementations already exist in TypeScript, Go, and Rust. The TypeScript reference (Decagon) uses Effect for type-safe error handling and provides both a server SDK and a React payment sheet component. The Go implementation (x402-go) is middleware-first and integrates with net/http handlers in a single line.

The beauty of 402 is that it's just HTTP. No proprietary APIs, no platform lock-in, no 30% app store cut. Any server, any client, any chain.`,
    price: 75,
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
    premiumContent: `Technical architecture for AI agent payment systems.

The next generation of AI agents won't just generate text — they'll browse the web, call APIs, and purchase resources on behalf of their operators. An agent researching a legal question might need to buy access to a case law database. A coding agent might pay for a premium API. A market analyst agent might unlock paywalled financial reports.

The challenge is delegation without danger. You want your agent to spend money, but not too much, not on the wrong things, and with a full audit trail. This is fundamentally a capability-based security problem.

Our architecture uses "Agent Tokens" — scoped API keys that encode a spend policy. Each policy specifies: (1) a per-action spending cap in cents, (2) a daily aggregate cap, (3) a set of allowed URL path patterns, and (4) an auto-approve threshold below which the agent can act without human confirmation.

When an agent encounters a 402 response, it extracts the payment challenge, checks it against its policy, and if approved, signs and submits the transaction using a delegated wallet. The server verifies the payment and returns a session token that the agent includes in subsequent requests.

We implemented this in TypeScript using Effect for composable error handling. The key types are SpendPolicy, Agent, and AgentToken. The spend-check pipeline runs in constant time: it loads the policy, checks the amount against per-action and daily caps, verifies the URL pattern against the allowlist, and either approves or rejects.

Safety mechanisms include: (1) daily cap resets at UTC midnight, (2) all transactions are logged with full receipts, (3) operators can revoke tokens instantly via the management API, and (4) the auto-approve threshold creates a natural "speed bump" for larger purchases.

In testing with LangChain-based research agents, we found that agents with $5/day caps and article-only allowlists could autonomously research topics across 10–15 paywalled sources per session, costing roughly $2–3 in micro-payments while producing significantly higher-quality output than agents limited to free sources.`,
    price: 100,
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
    premiumContent: `A practical guide to integrating stablecoins into your payment flow.

The promise of crypto payments has always been undermined by a simple problem: nobody wants to buy a coffee with an asset that might be worth 10% more tomorrow. Stablecoins solve this by pegging to a fiat currency — typically the US dollar — giving merchants predictable revenue and consumers predictable costs.

For micro-payments specifically, the chain you choose matters enormously. Ethereum mainnet charges $2–5 per transaction, making sub-dollar payments absurd. But Layer 2 solutions change the calculus entirely. Plasma testnet processes transactions for fractions of a cent with confirmation in 1–2 seconds. At these economics, paying $0.10 for an article is not just viable — it's cheaper than processing a credit card payment.

The integration pattern for stablecoin micro-payments follows a standard flow. First, the merchant deploys a receiver address (or uses a hosted service). Second, the client application requests a payment challenge from the server. Third, the user approves a wallet transaction. Fourth, the server monitors the chain for confirmation and credits the user's session.

One nuance that catches developers off guard: you need to handle both native token payments (where the value is in the transaction itself) and ERC-20 token payments (where the value is in a separate token transfer). Decagon's PaymentSheet abstracts this by reading the assetType field from the payment challenge and rendering the appropriate flow.

Settlement times vary by chain. On Plasma testnet, a transaction is typically included in a block within 2 seconds. On Optimism, it's 2–4 seconds. On Arbitrum, 0.5–2 seconds. For micro-payments, these are all effectively "instant" from the user's perspective.

Key metrics from our pilot with three publishers: average transaction value $0.47, median confirmation time 1.8s, payment success rate 97.2%, and chargeback rate 0.0% (because blockchain transactions are final).`,
    price: 60,
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
    premiumContent: `Research and analysis on subscription economics versus pay-per-use models.

The subscription economy exploded in the 2010s. Netflix, Spotify, Adobe Creative Cloud — suddenly everything was $9.99/month. By 2025 the average American household carried 12 active subscriptions totalling over $200/month, and 67% of consumers reported feeling overwhelmed by the sheer number of recurring charges on their statements.

The core problem with subscriptions is misaligned incentives. Publishers want to maximise subscriber count, so they create bundles. But the average user only reads 3–4 articles per month from any given publication. They're paying $10/month for $2 worth of content.

Pay-per-use models flip this dynamic. The reader pays exactly for what they consume. The creator gets paid for every piece of value they produce. There's no "subscriber who never logs in" subsiding the power users.

We surveyed 50,000 users across five pilot publications that offered both subscription and pay-per-article options. The findings were striking: (1) 41% of users who declined a subscription purchased at least one article via micro-payment, (2) per-article readers had 2.3× higher engagement (time on page, scroll depth) than subscribers, (3) creator revenue per article was 18% higher under the micro-payment model due to higher per-piece pricing, and (4) user satisfaction scores were 22% higher for pay-per-use.

The hybrid model works best: offer a subscription for power users, but let casual readers pay per article. This captures both segments and maximises total addressable revenue. The key is making the micro-payment flow as frictionless as the subscription login — which is exactly what one-click wallet payments enable.`,
    price: 80,
    currency: "USD",
    publishedAt: "2026-02-05T16:00:00Z",
    readTimeMinutes: 11,
    tags: ["subscriptions", "economics", "ux"],
  },
  {
    id: "article-6",
    title: "Zero-Knowledge Proofs Meet Micropayments",
    author: "Liam O'Connor",
    preview: "Privacy and payments have always been at odds. Zero-knowledge proofs offer a way to verify transactions without revealing the buyer's identity...",
    premiumContent: `How ZK proofs enable private micro-payments without sacrificing verifiability.

Every time you pay for an article with a credit card, the publisher learns your name, email, and often your browsing history. Even blockchain payments leak information — your wallet address is linked to every transaction you've ever made. For sensitive content (medical research, legal analysis, investigative journalism), this is a real barrier.

Zero-knowledge proofs offer an elegant solution: the buyer proves they paid the correct amount to the correct address without revealing which wallet the payment came from. The server verifies the proof, confirms the payment is valid, and grants access — all without learning who the buyer is.

The construction uses a ZK-SNARK circuit that takes as private inputs the sender address, transaction hash, and Merkle proof of inclusion in the block. The public inputs are the recipient address, amount, and block number. The prover generates a succinct proof that these constraints are satisfied, and the verifier checks it in constant time.

In practice, proof generation takes 2–3 seconds on a modern laptop — acceptable for a one-time payment flow. Verification is near-instant. The total overhead compared to a standard payment is about 3 seconds, which we hide behind a progress animation.

We built a prototype using Circom and snarkjs that integrates with the Decagon payment flow. The PaymentSheet detects when the user has opted into private mode and routes through the ZK prover instead of directly submitting the transaction hash. The server verifies the ZK proof and mints credits identically to the standard flow.

Early feedback from journalists and researchers has been overwhelmingly positive. One investigative reporter told us: "I can finally pay for documents without worrying that my source will be identified by tracing my wallet."`,
    price: 90,
    currency: "USD",
    publishedAt: "2026-02-10T08:00:00Z",
    readTimeMinutes: 14,
    tags: ["privacy", "zk-proofs", "cryptography"],
  },
  {
    id: "article-7",
    title: "Designing Payment UX That Converts",
    author: "Maya Johnson",
    preview: "The difference between a 2% and a 12% conversion rate on a paywall often comes down to design. Here's what we learned from A/B testing 30,000 payment flows...",
    premiumContent: `Lessons from 30,000 A/B-tested payment flows on how to design micro-payment UX.

We ran 47 A/B tests across six publications over four months, measuring conversion rate, time-to-pay, and post-payment satisfaction. The results challenged several common assumptions about payment UX.

Finding #1: Blur beats walls. Showing a blurred preview of premium content (with enough visible to create desire) converted 3.2× better than a hard cutoff with a "Subscribe to continue" message. The blur creates a sense of proximity — the content is right there, just slightly out of reach.

Finding #2: Price anchoring matters enormously. Showing "$0.50 — less than a coffee" converted 2.1× better than showing "$0.50" alone. Framing the price in terms of a familiar everyday purchase reduces the perceived cost.

Finding #3: The payment sheet must load in under 200ms. Every 100ms of additional latency reduced conversion by 7%. Users interpret slowness as insecurity. Pre-fetch the payment challenge while the user scrolls through the preview.

Finding #4: Show the receipt immediately. Users who see a receipt with a blockchain explorer link within 2 seconds of payment have a 94% return rate. Users who don't see confirmation for 5+ seconds have only a 61% return rate. Trust is built in the first moments after money changes hands.

Finding #5: Credit bundles increase lifetime value by 40%. Instead of charging per article, offer "Buy 10 credits for $4" (a 20% discount). Users spend credits more freely than cash, and the sunk cost effect drives return visits.

Finding #6: One-click repeat payments are essential. After the first purchase, subsequent paywalls should show a single "Unlock (1 credit)" button — no wallet interaction, no confirmation dialog. The goal is to make paying feel as natural as scrolling.

We distilled these findings into the Decagon PaymentSheet component, which implements all six patterns out of the box. Publishers using the default configuration see median conversion rates of 9.8% on first visits and 23% on return visits.`,
    price: 70,
    currency: "USD",
    publishedAt: "2026-02-14T12:00:00Z",
    readTimeMinutes: 9,
    tags: ["design", "ux", "conversion"],
  },
  {
    id: "article-8",
    title: "The Legal Landscape of Onchain Payments",
    author: "James Hartley",
    preview: "As onchain payments go mainstream, regulators are paying attention. We break down the current legal frameworks across the US, EU, and Asia, and what's coming next...",
    premiumContent: `A comprehensive overview of the regulatory landscape for onchain micro-payments.

The legal status of stablecoin payments varies dramatically by jurisdiction. In the United States, stablecoins are treated as "money transmission" in most states, requiring publishers who accept them to either use a licensed payment processor or obtain their own money transmitter license. However, the 2025 Stablecoin TRUST Act created a federal framework that exempts transactions under $100 from most reporting requirements — a critical carve-out for micro-payments.

In the European Union, the Markets in Crypto-Assets (MiCA) regulation took full effect in 2025 and classifies stablecoins as "e-money tokens." Publishers accepting stablecoin payments must partner with a licensed e-money institution, but the compliance burden is significantly lower than traditional payment processing. The key advantage: MiCA provides a single passport that works across all 27 EU member states.

Asia presents a patchwork. Singapore's Payment Services Act treats stablecoins favourably, requiring only a standard payment institution license. Japan allows stablecoin payments under its revised Payment Services Act but restricts which tokens are eligible. South Korea's Virtual Asset User Protection Act is still evolving.

For developers building payment infrastructure, the practical implications are: (1) use a licensed stablecoin (USDC, USDT) rather than an algorithmic one, (2) implement basic KYC for transactions above your jurisdiction's threshold, (3) maintain transaction logs with timestamps, amounts, and addresses for audit purposes, and (4) consult local counsel before accepting payments in a new jurisdiction.

The trend is clearly toward accommodation. Regulators recognise that blocking stablecoin payments is impractical and that the technology offers significant advantages in transparency and auditability over cash. The publishers who build compliant infrastructure now will have a significant first-mover advantage.`,
    price: 85,
    currency: "USD",
    publishedAt: "2026-02-18T15:00:00Z",
    readTimeMinutes: 13,
    tags: ["legal", "regulation", "compliance"],
  },
  {
    id: "article-9",
    title: "Plasma Network: The Layer 2 Built for Payments",
    author: "Yuki Tanaka",
    preview: "Not all Layer 2s are created equal. Plasma Network was designed from the ground up for high-throughput, low-latency payment transactions. Here's what makes it different...",
    premiumContent: `A technical deep-dive into Plasma Network's architecture and why it's ideal for micro-payments.

Plasma Network is an EVM-compatible Layer 2 rollup optimised for payment workloads. While general-purpose L2s like Optimism and Arbitrum handle everything from DeFi to NFTs, Plasma focuses on a single use case: moving value quickly and cheaply. This focus enables architectural choices that general-purpose chains can't make.

Block time on Plasma is 500ms — four times faster than Ethereum's 12 seconds and twice as fast as most L2s. This means a transaction is included in a block within half a second of submission, and the user sees confirmation in 1–2 seconds end-to-end. For a payment flow, this is the difference between "instant" and "waiting."

Transaction fees are a fraction of a cent. Plasma achieves this through aggressive calldata compression: payment transactions (simple value transfers) are compressed to just 20 bytes on L1, compared to the ~100+ bytes required by general-purpose rollups. The sequencer batches thousands of transactions into a single L1 commitment, amortising the base cost across all participants.

The native token, XPL, is used for gas fees and can also represent value directly. For USD-denominated payments, the Decagon protocol specifies amounts in cents and converts to XPL at the current exchange rate. The PaymentSheet handles this conversion transparently.

Data availability is ensured through Ethereum L1 calldata. Every Plasma batch is posted to Ethereum mainnet, meaning that even if the Plasma sequencer goes offline, all transaction data is recoverable from L1. Users can force-exit their funds through an L1 contract at any time.

For developers integrating with Plasma, the experience is identical to any EVM chain. Standard ethers.js or viem calls work out of the box. The only configuration required is the chain ID (9746 for testnet) and an RPC URL. Decagon's SDK abstracts even this — developers specify a chain ID in their config and the library handles the rest.`,
    price: 65,
    currency: "USD",
    publishedAt: "2026-02-22T10:00:00Z",
    readTimeMinutes: 11,
    tags: ["plasma", "layer2", "infrastructure"],
  },
  {
    id: "article-10",
    title: "From Paywall to Pay-Per-Query: Monetising APIs",
    author: "Raj Krishnamurthy",
    preview: "APIs are the backbone of the modern internet. What happens when every API call can be individually priced and settled on-chain?...",
    premiumContent: `How HTTP 402 transforms API monetisation from subscriptions to per-call billing.

Today's API economy runs on API keys and monthly invoices. Stripe charges $0.004 per API call. OpenAI charges per token. Twilio charges per message. But the billing is always aggregated — you get an invoice at the end of the month and hope it matches your expectations.

HTTP 402 enables a fundamentally different model: per-call, real-time, settled-on-chain. The API returns 402 with a payment challenge, the client pays, and the server processes the request. No accounts, no API keys, no invoices, no disputes.

The advantages are compelling: (1) Zero onboarding friction — any client with a wallet can call any API, (2) No credit risk — payment is collected before the work is done, (3) Global access — developers in countries without access to Stripe or traditional payment processors can use any API, (4) Machine-native — AI agents can discover and pay for APIs without human intervention.

We built a proof-of-concept "402 API gateway" that sits in front of any HTTP service and adds payment-required semantics. The configuration is a YAML file specifying which routes require payment and how much each costs. A request to a protected route returns 402 with a payment challenge. After payment, the gateway forwards the request to the upstream service and returns the response.

The gateway handles credit sessions natively: after an initial payment, the client receives a session token with N credits. Subsequent requests deduct credits without requiring new on-chain transactions. This reduces the effective cost per call to near zero after the initial top-up.

In a pilot with three AI-focused API providers, the 402 gateway processed 2.3 million paid API calls in one month. Average payment was $0.003 per call. Settlement was 100% on-chain. Dispute rate: 0%. Compare this to the traditional model where chargeback rates on API billing run 1.5–3% for international customers.

The future of API monetisation is not subscriptions or invoices. It's pay-per-call, settled in real time, on a chain fast enough that the user never waits.`,
    price: 95,
    currency: "USD",
    publishedAt: "2026-02-28T09:00:00Z",
    readTimeMinutes: 12,
    tags: ["apis", "monetization", "infrastructure"],
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

    getReceiptByChallenge: (challengeId: string) =>
      Effect.succeed(
        Array.from(receiptsDb.values()).find((r) => r.challengeId === challengeId) ?? null
      ),

    getReceiptByTxRef: (txRef: string) =>
      Effect.succeed(
        Array.from(receiptsDb.values()).find(
          (r) => r.transactionRef === txRef || r.txHash === txRef
        ) ?? null
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
// Mock PaymentVerifier
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
// Mock PolicyStore
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
// Mock AgentStore
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
// Mock UsageStore
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
// Mock ChainConfig
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
// Mock PlasmaRpc
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
  MockChainConfig,
  MockPlasmaRpc
);
