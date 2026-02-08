import { Context, Effect } from "effect";
import type { Receipt, SessionToken, ApiError } from "@decagon/x402";

export interface ReceiptsStore {
  readonly saveReceipt: (receipt: Receipt) => Effect.Effect<Receipt, ApiError>;
  readonly getReceipt: (receiptId: string) => Effect.Effect<Receipt, ApiError>;
  readonly saveSession: (session: SessionToken) => Effect.Effect<SessionToken, ApiError>;
  readonly getSession: (tokenId: string) => Effect.Effect<SessionToken, ApiError>;
  readonly consumeCredits: (tokenId: string, amount: number) => Effect.Effect<SessionToken, ApiError>;
  readonly addCredits: (tokenId: string, amount: number) => Effect.Effect<SessionToken, ApiError>;
  readonly hasReceiptForChallenge: (challengeId: string) => Effect.Effect<boolean, ApiError>;
  /** Look up an existing receipt by txHash/transactionRef. Returns null if none found. */
  readonly getReceiptByTxRef: (txRef: string) => Effect.Effect<Receipt | null, ApiError>;
}

export const ReceiptsStore = Context.GenericTag<ReceiptsStore>("@decagon/core/ReceiptsStore");
export type ReceiptsStoreService = Context.Tag.Service<typeof ReceiptsStore>;
