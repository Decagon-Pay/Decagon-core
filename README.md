# 🔷 Decagon

**Pay once, read instantly.**

Decagon is a pay-per-use payment layer for the web. It uses HTTP 402 ("Payment Required") and stablecoins to let humans and agents pay once and unlock content instantly — without accounts or subscriptions.

## The Problem

The web is broken for creators and consumers:

- **Creators** are forced into advertising (invasive, low CPM) or subscriptions (high friction, commitment)
- **Consumers** suffer from subscription fatigue — the average person has 12+ active subscriptions
- **AI Agents** can't access paid content at all — no way to programmatically pay for resources

## The Solution

Decagon enables **micro-payments at the HTTP layer**:

1. Request content → Server returns `HTTP 402 Payment Required` with a payment challenge
2. Pay via stablecoin → Receive a receipt and session token
3. Access content → Use session token for instant access

No accounts. No subscriptions. Just tap, pay, read.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Decagon Monorepo                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   apps/                                                         │
│   ├── web/          → Next.js frontend (marketplace UI)         │
│   └── api/          → Fastify HTTP server (402 handler)         │
│                                                                 │
│   packages/                                                     │
│   ├── x402/         → Protocol types (PaymentChallenge, etc.)   │
│   └── core/         → Effectful business logic                  │
│       ├── capabilities/  → Effect service interfaces            │
│       ├── workflows/     → Pure Effect workflows                │
│       └── mocks/         → Mock implementations                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Effectful Core**: All business logic expressed as pure Effect workflows
2. **Protocol-First**: HTTP 402 types defined independently of implementation
3. **Separation of Concerns**: HTTP layer only parses requests and maps responses
4. **Testable**: All I/O goes through injectable capability interfaces

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | pnpm + Turborepo |
| Frontend | Next.js (TypeScript) |
| Backend | Fastify (TypeScript) |
| Effect System | TypeScript + [effect](https://effect.website) |
| Database | SQLite (mock for now) |
| Payments | Plasma stablecoins (mock for now) |

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/decagon/decagon.git
cd decagon/Decagon-core

# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

This starts:
- **Web UI**: http://localhost:3000
- **API Server**: http://localhost:4000

### Available Commands

```bash
pnpm dev        # Start all services in development mode
pnpm build      # Build all packages
pnpm lint       # Lint all packages
pnpm typecheck  # Type-check all packages
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/articles` | List all articles (preview only) |
| GET | `/article/:id` | Get article - returns 402 or full content |
| GET | `/credits/balance` | Get current credit balance |
| POST | `/pay/verify` | Verify payment, get session token |

## HTTP 402 Flow (Step 2 - Implemented!)

```
Client                          Server
  │                               │
  │  GET /article/123             │
  │ ─────────────────────────────>│
  │                               │
  │  402 Payment Required         │
  │  { challenge, creditsOffered }│
  │ <─────────────────────────────│
  │                               │
  │  [User pays via Plasma mock]  │
  │                               │
  │  POST /pay/verify             │
  │  { challengeId, txRef, payer }│
  │ ─────────────────────────────>│
  │                               │
  │  200 OK                       │
  │  { receipt, sessionToken }    │
  │  (100 credits)                │
  │ <─────────────────────────────│
  │                               │
  │  GET /article/123             │
  │  Authorization: Bearer token  │
  │ ─────────────────────────────>│
  │                               │
  │  200 OK { fullContent }       │
  │  (1 credit consumed)          │
  │ <─────────────────────────────│
```

## Agent Demo

Run the agent demo script to see the full 402 flow:

```bash
npx tsx scripts/agent-demo.ts
```

## Project Status

### Step 1: Foundation ✅

- [x] Monorepo setup (pnpm + Turborepo)
- [x] Protocol types (`@decagon/x402`)
- [x] Effectful core (`@decagon/core`)
- [x] API server with placeholder routes
- [x] Web UI scaffold
- [x] Documentation

### Step 2: HTTP 402 Integration ✅

- [x] Return real HTTP 402 responses
- [x] ChallengesStore for payment challenges
- [x] Session token with credits
- [x] Content gating (1 credit per unlock)
- [x] Credits balance tracking
- [x] Checkout UI overlay
- [x] Agent demo script

### Step 3 (Future): Blockchain Integration

- [ ] Plasma stablecoin integration
- [ ] On-chain payment verification
- [ ] Wallet connection

## Contributing

Decagon is built for the Effectful Programming bounty. See [EFFECTS.md](./EFFECTS.md) for details on the effectful architecture.

## License

MIT
