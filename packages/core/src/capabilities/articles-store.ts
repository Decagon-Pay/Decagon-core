/**
 * ArticlesStore Capability
 * 
 * Interface for article persistence operations.
 * This is an effect boundary - implementations handle the actual I/O.
 */

import { Context, Effect } from "effect";
import type { Article, ApiError } from "@decagon/x402";

/**
 * Service interface for article storage operations
 */
export interface ArticlesStore {
  /**
   * Retrieve an article by its ID
   */
  readonly getById: (
    id: string
  ) => Effect.Effect<Article, ApiError>;

  /**
   * List all available articles
   */
  readonly listAll: () => Effect.Effect<readonly Article[], ApiError>;

  /**
   * Check if an article exists
   */
  readonly exists: (id: string) => Effect.Effect<boolean, ApiError>;
}

/**
 * Effect Context Tag for ArticlesStore
 * Used for dependency injection in Effect workflows
 */
export const ArticlesStore = Context.GenericTag<ArticlesStore>("@decagon/core/ArticlesStore");

/**
 * Type helper for the ArticlesStore service
 */
export type ArticlesStoreService = Context.Tag.Service<typeof ArticlesStore>;
