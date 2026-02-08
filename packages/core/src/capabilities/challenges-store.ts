import { Context, Effect } from "effect";
import type { PaymentChallenge, ApiError } from "@decagon/x402";

export interface ChallengesStore {
  readonly save: (challenge: PaymentChallenge) => Effect.Effect<PaymentChallenge, ApiError>;
  readonly get: (challengeId: string) => Effect.Effect<PaymentChallenge, ApiError>;
  readonly markPaid: (challengeId: string) => Effect.Effect<PaymentChallenge, ApiError>;
  readonly markExpired: (challengeId: string) => Effect.Effect<PaymentChallenge, ApiError>;
  readonly exists: (challengeId: string) => Effect.Effect<boolean, ApiError>;
}

export const ChallengesStore = Context.GenericTag<ChallengesStore>("@decagon/core/ChallengesStore");
export type ChallengesStoreService = Context.Tag.Service<typeof ChallengesStore>;
