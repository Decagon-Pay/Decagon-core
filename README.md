# Decagon — HTTP 402 Payment Layer for Humans & AI Agents

> Programmable pay-per-use payments via **HTTP 402 Payment Required** on Plasma Testnet.  
> Content access, remittance, agent automation — one protocol.

---

## What Decagon Does

Decagon is a **general-purpose payment layer** built on HTTP 402.  
Any resource that costs money returns `402 Payment Required` with a `PaymentChallenge`.  
The client pays on-chain, submits proof, and gains access.

**Two demo verticals ship today:**

| Vertical | Flow |
|----------|------|
| **Article Unlock** | `GET /article/:id` → 402 → pay → 200 + premium content |
| **Remittance** | `POST /transfer/create` → 402 → pay → transfer confirmed |

Both share the same **PaymentSheet** UI component (from `@decagon/ui`), the same **PaymentChallenge** type, and the same **verify** workflow.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+, pnpm 9+
- [MetaMask](https://metamask.io/) with **Plasma Testnet** configured:
  - RPC: `https://testnet-rpc.plasma.to` · Chain ID: `9746` · Symbol: `ETH`
- Testnet ETH from [Plasma Faucet](https://faucet.plasma.to/)

### Local Development

```bash
git clone https://github.com/your-org/decagon.git
cd decagon/Decagon-core
pnpm install

# Terminal 1 — API server (port 4000)
cd apps/api && pnpm dev

# Terminal 2 — Web app (port 3000)
cd apps/web && pnpm dev
```

### Environment Variables

**API** (`apps/api/.env`):
```bash
PORT=4000
HOST=0.0.0.0
USE_SQLITE=true               # Persistent storage
DB_PATH=./data/decagon.db
ALLOWED_ORIGINS=http://localhost:3000
PAYEE_ADDRESS=0x...            # Your wallet
PLASMA_RPC_URL=https://testnet-rpc.plasma.to
```

**Web** (`apps/web/.env`):
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

---

## 🔌 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Health check |
| `GET`  | `/article/:id` | Article access (402-gated) |
| `GET`  | `/articles` | List all articles |
| `GET`  | `/credits/balance` | Credit balance |
| `POST` | `/pay/verify` | Verify payment, issue session |
| `GET`  | `/policy` | Get spend policy |
| `POST` | `/policy` | Set spend policy |
| `POST` | `/policy/check` | Pre-authorize payment |
| `POST` | `/agent/create` | Create scoped agent token |
| `GET`  | `/agent/list` | List agents |
| `POST` | `/transfer/create` | Create remittance transfer |
| `POST` | `/transfer/verify` | Verify transfer payment |
| `GET`  | `/transfer/history` | Transfer history |

### HTTP 402 Flow

```
Client                            Server
  │                                 │
  │  GET /article/:id               │
  │  ──────────────────────────────>│
  │                                 │
  │  402 + PaymentChallenge         │
  │  <──────────────────────────────│
  │                                 │
  │  [MetaMask signs tx on Plasma]  │
  │                                 │
  │  POST /pay/verify {txHash}      │
  │  ──────────────────────────────>│
  │                                 │
  │  200 {receipt, sessionToken}    │
  │  <──────────────────────────────│
  │                                 │
  │  GET /article/:id               │
  │  Authorization: Bearer <token>  │
  │  ──────────────────────────────>│
  │                                 │
  │  200 {article, hasFullAccess}   │
  │  <──────────────────────────────│
```

---

## 🤖 Agent Demo Script

Test the full flow programmatically — policy checks, blocked payments, agent tokens, remittance:

```bash
# Local
pnpm tsx scripts/agent-demo.ts

# Production
API_BASE=https://decagon-api.fly.dev pnpm tsx scripts/agent-demo.ts

# With on-chain verification
TX_HASH=0x... pnpm tsx scripts/agent-demo.ts
```

---

## 📦 Package Structure

```
Decagon-core/
├── packages/
│   ├── x402/               # HTTP 402 protocol types (no logic)
│   ├── core/               # Effectful business logic
│   │   ├── capabilities/   #   Effect service interfaces (I/O boundaries)
│   │   ├── workflows/      #   Pure Effect workflows
│   │   ├── policy/         #   Pure policy check function
│   │   ├── mocks/          #   In-memory mock implementations
│   │   └── live/           #   Real RPC + verifier implementations
│   └── ui/                 # React UI SDK (@decagon/ui)
│       ├── PaymentSheet    #   Universal payment modal
│       ├── useDecagonPayment # React hook for payment state
│       └── types           #   Shared UI types
├── apps/
│   ├── api/                # Fastify HTTP server + SQLite
│   └── web/                # Next.js 14 frontend
├── scripts/
│   └── agent-demo.ts       # CLI demo script
├── EFFECTS.md              # Effectful architecture docs
└── pnpm-workspace.yaml
```

---

## 🧩 UI SDK (`@decagon/ui`)

The `@decagon/ui` package provides a reusable **PaymentSheet** component for any vertical:

```tsx
import { PaymentSheet, useDecagonPayment } from "@decagon/ui";

function MyPage() {
  const payment = useDecagonPayment();

  const handleBuy = async () => {
    const challenge = await fetchChallenge();
    payment.open({ challenge, config: { apiBase: "...", plasmaChainId: 9746 } });
  };

  return (
    <>
      <button onClick={handleBuy}>Buy</button>
      {payment.isOpen && (
        <PaymentSheet
          challenge={payment.challenge!}
          config={payment.config!}
          purpose="remittance"       {/* or omit for article unlock */}
          onClose={payment.close}
          onSuccess={payment.onSuccess}
        />
      )}
    </>
  );
}
```

The same `PaymentSheet` handles wallet connection, transaction signing, verification, and receipt display for both articles and remittance.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 14)                        │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ Article    │  │ Remittance   │  │ Agent Dashboard         │ │
│  │ Unlock     │  │ Transfer     │  │ (policy + tokens)       │ │
│  └─────┬──────┘  └──────┬───────┘  └────────────┬────────────┘ │
│        └────────────┬────┘                       │              │
│              @decagon/ui PaymentSheet            │              │
└──────────────────────┬───────────────────────────┘──────────────┘
                       │ HTTP/REST
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Server (Fastify)                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  runWorkflow()  →  Effect.provide(workflow, Capabilities) │   │
│  └──────────────────────────────────────────────────────────┘   │
│                       │                                          │
│    ┌──────────────────┴──────────────────┐                      │
│    ▼                                     ▼                      │
│  In-Memory Mocks (dev)         SQLite Stores (prod)             │
│  (Challenges, Articles)        (Receipts, Policies, Agents)     │
└──────────────────────────────────────┬──────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Plasma Testnet (Chain 9746)                    │
│  RPC: testnet-rpc.plasma.to  ·  Explorer: testnet.plasmascan.to│
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚢 Deployment

### API → Fly.io

```bash
fly apps create decagon-api
fly volumes create decagon_data --region sjc --size 1
fly secrets set PRIVATE_KEY=0x... --app decagon-api
fly deploy --app decagon-api
```

### Web → Vercel

```bash
cd apps/web
vercel
vercel env add NEXT_PUBLIC_API_BASE_URL  # https://decagon-api.fly.dev
```

---

## 🛠 Technologies

| Layer | Tech |
|-------|------|
| Type system | [Effect TS](https://effect.website) — typed functional programming |
| API | [Fastify](https://fastify.dev) — high-performance HTTP |
| Frontend | [Next.js 14](https://nextjs.org) — App Router |
| Persistence | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — embedded SQL |
| Chain | [Plasma Testnet](https://plasma.to) — EVM L2, chain 9746 |
| Hosting | Fly.io (API) + Vercel (Web) |

---

## 📄 License

MIT
