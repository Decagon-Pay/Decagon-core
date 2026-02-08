# @decagon/ui

Plug-and-play React payment-sheet SDK for **Decagon HTTP 402** flows.

Drop `<PaymentSheet>` into any React app to add pay-per-use article unlocks, remittance transfers, or agent-token purchases — all settled on Plasma.

---

## Installation

```bash
# Inside a pnpm workspace (monorepo)
pnpm add @decagon/ui

# Or standalone
npm install @decagon/ui
```

### Peer dependencies

| Package     | Version          |
| ----------- | ---------------- |
| `react`     | `^18.0 \|\| ^19.0` |
| `react-dom` | `^18.0 \|\| ^19.0` |

---

## Quick Start

```tsx
import { PaymentSheet, useDecagonPayment } from "@decagon/ui";
import type { DecagonChallenge, DecagonReceipt } from "@decagon/ui";

const API_BASE = "http://localhost:4000";
const PLASMA_CHAIN_ID = 9746;
const PLASMA_EXPLORER_TX_BASE = "https://testnet.plasmascan.to/tx/";

export default function ArticlePage() {
  const payment = useDecagonPayment();

  const handleUnlock = async () => {
    // 1. Request a payment challenge from your API
    const res = await fetch(`${API_BASE}/article/my-article-id`);
    const { challenge } = await res.json();

    // 2. Open the payment sheet
    payment.open({
      challenge,
      config: { apiBase: API_BASE, plasmaChainId: PLASMA_CHAIN_ID, explorerTxBase: PLASMA_EXPLORER_TX_BASE },
      purpose: "Unlock article",
      onSuccess: (receipt, sessionToken) => {
        console.log("Paid!", receipt);
        // Persist sessionToken for re-access
      },
      onClose: () => console.log("Closed"),
    });
  };

  return (
    <>
      <button onClick={handleUnlock}>Unlock for $0.25</button>

      {payment.isOpen && payment.challenge && payment.config && (
        <PaymentSheet
          challenge={payment.challenge}
          config={payment.config}
          purpose={payment.purpose}
          existingSessionTokenId={payment.existingSessionTokenId}
          onClose={payment.close}
          onSuccess={payment.onSuccess}
        />
      )}
    </>
  );
}
```

---

## Exports

### Components

| Export           | Description                                     |
| ---------------- | ----------------------------------------------- |
| `PaymentSheet`   | Modal payment UI: email → policy → confirm → pay |

### Hooks

| Export                | Description                                  |
| --------------------- | -------------------------------------------- |
| `useDecagonPayment()` | State manager for opening/closing the sheet  |

### Types

| Export                        | Description                             |
| ----------------------------- | --------------------------------------- |
| `DecagonChallenge`            | Server-issued payment challenge         |
| `DecagonReceipt`              | On-chain receipt after verification     |
| `DecagonPolicyResult`         | Spend-policy check result               |
| `DecagonSpendPolicy`          | Per-action and daily-cap limits         |
| `DecagonPaymentConfig`        | API base URL + chain config             |
| `OpenDecagonPaymentOptions`   | Options passed to `payment.open()`      |
| `PaymentSheetProps`           | Props for `<PaymentSheet />`            |
| `UseDecagonPaymentReturn`     | Return type of `useDecagonPayment()`    |
| `PaymentStep`                 | Union of internal UI step names         |

---

## Configuration

The `config` object passed to `payment.open()` requires:

| Key              | Type     | Description                                     |
| ---------------- | -------- | ----------------------------------------------- |
| `apiBase`        | `string` | Your Decagon API URL (e.g. `http://localhost:4000`) |
| `plasmaChainId`  | `number` | Plasma chain ID (`9746` for testnet)            |
| `explorerTxBase` | `string` | Block-explorer base URL for transaction links   |

These are typically sourced from environment variables:

```ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const PLASMA_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_PLASMA_CHAIN_ID ?? "9746", 10);
const PLASMA_EXPLORER_TX_BASE = process.env.NEXT_PUBLIC_PLASMA_EXPLORER_TX_BASE ?? "https://testnet.plasmascan.to/tx/";
```

---

## PaymentSheet Props

```ts
interface PaymentSheetProps {
  challenge: DecagonChallenge;    // From your API's 402 response
  config: DecagonPaymentConfig;   // API + chain config
  purpose?: string;               // Display label (e.g. "Unlock article")
  existingSessionTokenId?: string; // Reuse a prior session
  onClose: () => void;
  onSuccess: (receipt: DecagonReceipt, sessionToken: unknown) => void;
}
```

---

## useDecagonPayment()

```ts
const payment = useDecagonPayment();

payment.open(options);  // Show the sheet
payment.close();        // Programmatically close
payment.isOpen;         // boolean
payment.challenge;      // DecagonChallenge | null
payment.config;         // DecagonPaymentConfig | null
payment.onSuccess;      // bound callback
```

---

## Payment Flow

```
User clicks "Unlock"
  → Your API returns a DecagonChallenge (HTTP 402)
  → payment.open({ challenge, config, onSuccess })
  → PaymentSheet renders:
      1. Email collection
      2. Spend-policy check
      3. Confirmation summary
      4. MetaMask signing (or demo mode)
      5. On-chain verification
      6. Success receipt
  → onSuccess(receipt, sessionToken) fires
```

---

## Styling

The PaymentSheet renders with BEM-style `dg-*` CSS classes. The host app must provide these styles — see [globals.css](../../apps/web/src/app/globals.css) for the reference implementation using CSS custom properties.

---

## License

MIT
