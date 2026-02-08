/**
 * @decagon/ui: Plug-and-play payment UI SDK
 *
 * @example
 * ```tsx
 * import { PaymentSheet, useDecagonPayment } from "@decagon/ui";
 * import type { DecagonChallenge, DecagonReceipt } from "@decagon/ui";
 * ```
 *
 * @packageDocumentation
 */

/* ─── Components ─── */
export { PaymentSheet } from "./PaymentSheet";
export type { PaymentSheetProps } from "./PaymentSheet";

/* ─── Hooks ─── */
export { useDecagonPayment } from "./useDecagonPayment";
export type { UseDecagonPaymentReturn } from "./useDecagonPayment";

/* ─── Types ─── */
export type {
  DecagonChallenge,
  DecagonReceipt,
  DecagonPolicyResult,
  DecagonSpendPolicy,
  DecagonPaymentConfig,
  OpenDecagonPaymentOptions,
  PaymentStep,
} from "./types";
