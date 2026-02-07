# Decagon – AI Agent Micropayments via HTTP 402

> **Hackathon Demo**: Pay-per-call AI agents using HTTP 402 Payment Required + Plasma testnet

## 🚀 Try the Live Demo

**Live Web App**: `https://decagon-web.vercel.app` *(deploy pending)*  
**Live API**: `https://decagon-api.fly.dev` *(deploy pending)*

### Quick Start (30 seconds)
1. Install [MetaMask](https://metamask.io/) browser extension
2. Add **Plasma Testnet** to MetaMask:
   - Network Name: `Plasma Testnet`
   - RPC URL: `https://testnet-rpc.plasma.to`
   - Chain ID: `9746`
   - Currency Symbol: `ETH`
3. Get testnet ETH from [Plasma Faucet](https://faucet.plasma.to/)
4. Visit the live demo URL and connect your wallet
5. Try calling an AI agent – MetaMask will prompt for the 0.00001 ETH micropayment

---

## 📋 Local Development

### Prerequisites
- Node.js 20+
- pnpm 9+
- MetaMask wallet

### Setup

```bash
# Clone the repo
git clone https://github.com/your-org/decagon.git
cd decagon/Decagon-core

# Install dependencies
pnpm install

# Copy environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Edit apps/api/.env with your values:
# - PRIVATE_KEY (MetaMask export or generate new)
# - USE_SQLITE=true (for persistence)

# Build all packages
pnpm build

# Start API server (port 4000)
cd apps/api && pnpm dev

# In another terminal, start web app (port 3000)
cd apps/web && pnpm dev
```

### Environment Variables

**API (`apps/api/.env`)**:
```bash
PORT=4000
HOST=0.0.0.0
PRIVATE_KEY=0x...           # Server wallet private key
USE_SQLITE=true             # Enable SQLite persistence
DB_PATH=./data/decagon.db   # SQLite database path
ALLOWED_ORIGINS=http://localhost:3000
```

**Web (`apps/web/.env`)**:
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

---

## 🤖 Agent Demo Script

Test the full HTTP 402 flow programmatically:

```bash
cd Decagon-core

# Run against local API
pnpm tsx scripts/agent-demo.ts

# Run against production API
API_BASE=https://decagon-api.fly.dev pnpm tsx scripts/agent-demo.ts
```

The script demonstrates:
1. Create a session for an AI agent
2. Call `/agents/:id/call` → receive `402 Payment Required`
3. Parse the `X-402-*` headers for payment details
4. Sign and send payment on Plasma testnet
5. Retry with `X-402-Receipt` header → receive AI response

---

## 🔌 API Endpoints

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/agents` | List available agents |
| `GET` | `/agents/:id` | Get agent details |
| `POST` | `/agents/:id/session` | Create payment session |
| `POST` | `/agents/:id/call` | Call agent (402 gated) |
| `POST` | `/pay/verify` | Verify payment receipt |
| `GET` | `/receipts/:hash` | Get receipt by tx hash |

### HTTP 402 Flow

```
Client                          Server
  │                               │
  │ POST /agents/:id/call         │
  │ ──────────────────────────────>
  │                               │
  │ 402 Payment Required          │
  │ X-402-Price: 10000000000000   │
  │ X-402-Address: 0x...          │
  │ X-402-Network: 9746           │
  │ <──────────────────────────────
  │                               │
  │ [User signs tx in MetaMask]   │
  │                               │
  │ POST /pay/verify              │
  │ { txHash, sessionToken }      │
  │ ──────────────────────────────>
  │                               │
  │ 200 { receipt, session }      │
  │ <──────────────────────────────
  │                               │
  │ POST /agents/:id/call         │
  │ X-402-Receipt: <receipt>      │
  │ ──────────────────────────────>
  │                               │
  │ 200 { result: "AI response" } │
  │ <──────────────────────────────
```

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌─────────┐  ┌──────────────┐  ┌─────────────────────────────┐ │
│  │ Agent   │  │ Payment      │  │ MetaMask Integration        │ │
│  │ Browser │  │ Sheet Modal  │  │ (Plasma Testnet)            │ │
│  └─────────┘  └──────────────┘  └─────────────────────────────┘ │
└──────────────────────────────────┬──────────────────────────────┘
                                   │ HTTP/REST
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Server (Fastify)                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    HTTP 402 Middleware                      ││
│  │  • Check X-402-Receipt header                               ││
│  │  • Validate receipt signature & payment amount              ││
│  │  • Deduct from session balance                              ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────────┐ │
│  │ Receipts  │  │ Sessions  │  │ Policies  │  │ Agents       │ │
│  │ Store     │  │ Store     │  │ Store     │  │ Store        │ │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └──────┬───────┘ │
│        │              │              │               │          │
│        └──────────────┴──────────────┴───────────────┘          │
│                              │                                   │
│              ┌───────────────┴───────────────┐                  │
│              ▼                               ▼                  │
│        In-Memory (dev)              SQLite (prod)               │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Plasma Testnet (Chain 9746)                 │
│  • RPC: https://testnet-rpc.plasma.to                           │
│  • Explorer: https://testnet.plasmaexplorer.com                 │
│  • Faucet: https://faucet.plasma.to                             │
└─────────────────────────────────────────────────────────────────┘
```

### Package Structure

```
Decagon-core/
├── packages/
│   ├── x402-core/          # HTTP 402 types & validation (Effect TS)
│   └── decagon-core/       # Domain types (Agent, Receipt, Session)
├── apps/
│   ├── api/                # Fastify server + SQLite persistence
│   └── web/                # Next.js 15 + React 19 frontend
├── scripts/
│   └── agent-demo.ts       # CLI demo script
└── pnpm-workspace.yaml     # Monorepo config
```

---

## 🚢 Deployment

### API → Fly.io

```bash
cd Decagon-core

# Install Fly CLI
# Windows: iwr https://fly.io/install.ps1 -useb | iex
# macOS/Linux: curl -L https://fly.io/install.sh | sh

# Login to Fly
fly auth login

# Create app (first time only)
fly apps create decagon-api

# Create persistent volume for SQLite
fly volumes create decagon_data --region sjc --size 1

# Set secrets
fly secrets set PRIVATE_KEY=0x... --app decagon-api

# Deploy
fly deploy --app decagon-api
```

### Web → Vercel

```bash
cd Decagon-core/apps/web

# Install Vercel CLI
npm i -g vercel

# Deploy (follow prompts)
vercel

# Set environment variable
vercel env add NEXT_PUBLIC_API_BASE_URL
# Enter: https://decagon-api.fly.dev
```

---

## ✅ Project Status

### Completed ✓
- [x] **Step 1**: Project scaffold (pnpm monorepo, Effect TS)
- [x] **Step 2**: x402 payment types & validation
- [x] **Step 3**: API server with 402 middleware
- [x] **Step 4**: React frontend with MetaMask integration
- [x] **Step 5**: Production deployment configs

### HTTP 402 Headers (x402 spec compliant)
- `X-402-Price` – Price in wei
- `X-402-Address` – Payment recipient address
- `X-402-Network` – Chain ID (9746 for Plasma testnet)
- `X-402-Receipt` – Signed payment proof (client → server)

---

## 🛠 Technologies

- **Effect TS** – Typed functional programming
- **Fastify** – High-performance HTTP server
- **Next.js 15** – React framework (App Router)
- **better-sqlite3** – Embedded SQLite database
- **ethers.js** – Ethereum wallet integration
- **Plasma** – EVM-compatible L2 testnet
- **Fly.io** – API hosting with volumes
- **Vercel** – Frontend hosting

---

## 📄 License

MIT
