/**
 * PolicyStore Capability
 * 
 * Manages spend policies for users.
 * Policies control payment limits and allowed access patterns.
 */

import { Context, Effect } from "effect";
import type { SpendPolicy, ApiError } from "@decagon/x402";

export interface PolicyStore {
  /** Get the spend policy for a user */
  readonly getUserPolicy: (userId: string) => Effect.Effect<SpendPolicy, ApiError>;

  /** Set the spend policy for a user */
  readonly setUserPolicy: (userId: string, policy: SpendPolicy) => Effect.Effect<SpendPolicy, ApiError>;

  /** Check if a user has a custom policy set */
  readonly hasUserPolicy: (userId: string) => Effect.Effect<boolean, ApiError>;
}

export const PolicyStore = Context.GenericTag<PolicyStore>("@decagon/core/PolicyStore");
export type PolicyStoreService = Context.Tag.Service<typeof PolicyStore>;
