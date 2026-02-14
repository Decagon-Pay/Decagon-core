# Decagon

> Pay-per-use payments for the web using HTTP 402 on Plasma.

**[Me LOOKSMAXXING](https://github.com/Decagon-Pay)** · **[Live Demo](https://decagon-core-web.vercel.app/)** · **[EFFECTS.md](./EFFECTS.md)**

---

## Quick Start

### Prerequisites

- Node.js 20+, pnpm 9+
- [MetaMask](https://metamask.io/) with Plasma Testnet added (RPC: `https://testnet-rpc.plasma.to`, Chain ID: `9746`)
- Testnet ETH from the [Plasma Faucet](https://faucet.plasma.to/)

### Run Locally

```bash
git clone https://github.com/Decagon-Pay/decagon-core.git
cd Decagon-core
pnpm install

# Terminal 1: API
cd apps/api && pnpm dev

# Terminal 2: Web
cd apps/web && pnpm dev
```

Open http://localhost:3000 and try unlocking an article with MetaMask.

### Environment Variables

**API** (`apps/api/.env`):
```
PLASMA_RPC_URL=https://testnet-rpc.plasma.to
PLASMA_CHAIN_ID=9746
PAYEE_ADDRESS=0x...
USE_SQLITE=true
DB_PATH=./data/decagon.db
ALLOWED_ORIGINS=http://localhost:3000
```

**Web** (`apps/web/.env`):
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

---

## How It Works

Decagon turns any HTTP endpoint into a paid resource using the `402 Payment Required` status code.

### The Flow

1. Client requests a resource (`GET /article/:id`)
2. Server returns **402** with a `PaymentChallenge` (amount, chain, payee address)
3. Client pays on-chain via MetaMask on Plasma
4. Client submits the `txHash` to `POST /pay/verify`
5. Server verifies on-chain, issues a `SessionToken` with credits
6. Client re-requests the resource with the token and gets full access

This works for any vertical. The same flow powers both the **article paywall** and the **remittance transfer** demos.

### SDK

The `@decagon/ui` package gives you a drop-in `<PaymentSheet />` component that handles wallet connection, transaction signing, verification, and receipts:

```tsx
import { PaymentSheet } from "@decagon/ui";

<PaymentSheet
  challenge={challenge}
  config={{ apiBase: "https://decagon-api.fly.dev", plasmaChainId: 9746 }}
  onClose={() => setOpen(false)}
  onSuccess={(receipt, session) => { /* unlock content */ }}
/>
```

### Architecture

The backend is built with [Effect](https://effect.website). All business logic is expressed as pure workflows that declare their dependencies (storage, RPC, clock, etc.) through the type system. Side effects only happen at the boundary when Fastify route handlers provide real implementations.

See [EFFECTS.md](./EFFECTS.md) for the full architecture breakdown.

```
Decagon-core/
  packages/
    x402/       HTTP 402 protocol types
    core/       Effect workflows, capabilities, mocks
    ui/         React PaymentSheet SDK
  apps/
    api/        Fastify server + SQLite
    web/        Next.js 14 frontend
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Health check |
| `GET`  | `/articles` | List all articles |
| `GET`  | `/article/:id` | Get article (402 if unpaid) |
| `POST` | `/pay/verify` | Verify payment, issue session |
| `GET`  | `/credits/balance` | Check credit balance |
| `POST` | `/transfer/create` | Create remittance transfer |
| `POST` | `/transfer/verify` | Verify transfer payment |
| `GET`  | `/transfer/history` | Transfer history |
| `POST` | `/policy` | Set spend policy |
| `POST` | `/policy/check` | Pre-authorize a payment |
| `POST` | `/agent/create` | Create scoped agent token |

### Deployment

- **API**: Fly.io with SQLite on a persistent volume
- **Web**: Vercel

---

## License

MIT

