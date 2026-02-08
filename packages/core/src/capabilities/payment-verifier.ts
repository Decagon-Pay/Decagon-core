/**
 * PaymentVerifier Capability
 * 
 * Interface for verifying payments.
 * Supports real on-chain verification via RPC.
 */

import { Context, Effect } from "effect";
import type { PaymentChallenge, ApiError } from "@decagon/x402";

/**
 * Payment proof submitted by client
 */
export interface PaymentProof {
  /** Transaction hash/reference */
  readonly transactionRef: string;

  /** Blockchain transaction hash for on-chain verification */
  readonly txHash?: string;

  /** Payer wallet address */
  readonly payerAddress: string;

  /** Chain the payment was made on */
  readonly chain: string;
}

/**
 * Result of payment verification
 */
export interface VerificationResult {
  /** Whether the payment is valid */
  readonly valid: boolean;

  /** Verified amount in cents (may differ from claimed) */
  readonly verifiedAmount: number;

  /** Verification timestamp */
  readonly verifiedAt: string;

  /** Error message if invalid */
  readonly errorMessage?: string;

  /** Transaction hash */
  readonly txHash?: string;

  /** Block number where tx was confirmed */
  readonly blockNumber?: number;

  /** Amount in wei as string */
  readonly amountWei?: string;

  /** Amount in native token display (e.g., "0.0001 XPL") */
  readonly amountNative?: string;

  /** Payer address */
  readonly payerAddress?: string;

  /** Payee address */
  readonly payeeAddress?: string;

  /** Full explorer URL for the transaction */
  readonly explorerUrl?: string;
}

/**
 * Service interface for payment verification
 */
export interface PaymentVerifier {
  /**
   * Verify a payment proof against a challenge
   */
  readonly verify: (
    challenge: PaymentChallenge,
    proof: PaymentProof
  ) => Effect.Effect<VerificationResult, ApiError>;

  /**
   * Check if a transaction reference has already been used
   */
  readonly isTransactionUsed: (
    transactionRef: string
  ) => Effect.Effect<boolean, ApiError>;

  /**
   * Mark a transaction as used (prevent double-spending)
   */
  readonly markTransactionUsed: (
    transactionRef: string
  ) => Effect.Effect<void, ApiError>;
}

/**
 * Effect Context Tag for PaymentVerifier
 */
export const PaymentVerifier = Context.GenericTag<PaymentVerifier>("@decagon/core/PaymentVerifier");

/**
 * Type helper for the PaymentVerifier service
 */
export type PaymentVerifierService = Context.Tag.Service<typeof PaymentVerifier>;
