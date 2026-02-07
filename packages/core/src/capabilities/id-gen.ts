/**
 * IdGen Capability
 * 
 * Interface for generating unique identifiers.
 * This is an effect boundary - allows deterministic IDs in tests.
 */

import { Context, Effect } from "effect";

/**
 * Service interface for ID generation
 */
export interface IdGen {
  /**
   * Generate a unique challenge ID
   */
  readonly challengeId: () => Effect.Effect<string, never>;

  /**
   * Generate a unique receipt ID
   */
  readonly receiptId: () => Effect.Effect<string, never>;

  /**
   * Generate a unique session token ID
   */
  readonly sessionTokenId: () => Effect.Effect<string, never>;

  /**
   * Generate a generic unique ID with prefix
   */
  readonly generate: (prefix: string) => Effect.Effect<string, never>;
}

/**
 * Effect Context Tag for IdGen
 */
export const IdGen = Context.GenericTag<IdGen>("@decagon/core/IdGen");

/**
 * Type helper for the IdGen service
 */
export type IdGenService = Context.Tag.Service<typeof IdGen>;
