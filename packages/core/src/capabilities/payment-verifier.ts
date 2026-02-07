/**
 * PaymentVerifier Capability
 * 
 * Interface for verifying payments.
 * This is an effect boundary - future implementations will verify on-chain transactions.
 * For now, this is a mock that always succeeds.
 */

import { Context, Effect } from "effect";
import type { PaymentChallenge, ApiError } from "@decagon/x402";

/**
 * Payment proof submitted by client
 */
export interface PaymentProof {
  /** The challenge being satisfied */
  readonly challengeId: string;

  /** Transaction hash/reference (mock for now) */
  readonly transactionRef: string;

  /** Sender address (mock for now) */
  readonly fromAddress: string;

  /** Amount claimed to be paid */
  readonly amount: number;

  /** Currency of payment */
  readonly currency: string;
}

/**
 * Result of payment verification
 */
export interface VerificationResult {
  /** Whether the payment is valid */
  readonly valid: boolean;

  /** Verified amount (may differ from claimed) */
  readonly verifiedAmount: number;

  /** Verification timestamp */
  readonly verifiedAt: string;

  /** Error message if invalid */
  readonly errorMessage?: string;
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
