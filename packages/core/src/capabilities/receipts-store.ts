/**
 * ReceiptsStore Capability
 * 
 * Interface for receipt and session persistence operations.
 * This is an effect boundary - implementations handle the actual I/O.
 */

import { Context, Effect } from "effect";
import type { Receipt, SessionToken, ApiError } from "@decagon/x402";

/**
 * Service interface for receipt and session storage operations
 */
export interface ReceiptsStore {
  /**
   * Save a new receipt
   */
  readonly saveReceipt: (
    receipt: Receipt
  ) => Effect.Effect<Receipt, ApiError>;

  /**
   * Retrieve a receipt by ID
   */
  readonly getReceipt: (
    receiptId: string
  ) => Effect.Effect<Receipt, ApiError>;

  /**
   * Save a new session token
   */
  readonly saveSession: (
    session: SessionToken
  ) => Effect.Effect<SessionToken, ApiError>;

  /**
   * Retrieve a session by token ID
   */
  readonly getSession: (
    tokenId: string
  ) => Effect.Effect<SessionToken, ApiError>;

  /**
   * Update session balance after access
   */
  readonly updateSessionBalance: (
    tokenId: string,
    newBalance: number,
    newAccessCount: number
  ) => Effect.Effect<SessionToken, ApiError>;

  /**
   * Check if a receipt exists for a given challenge
   */
  readonly hasReceiptForChallenge: (
    challengeId: string
  ) => Effect.Effect<boolean, ApiError>;
}

/**
 * Effect Context Tag for ReceiptsStore
 */
export const ReceiptsStore = Context.GenericTag<ReceiptsStore>("@decagon/core/ReceiptsStore");

/**
 * Type helper for the ReceiptsStore service
 */
export type ReceiptsStoreService = Context.Tag.Service<typeof ReceiptsStore>;
