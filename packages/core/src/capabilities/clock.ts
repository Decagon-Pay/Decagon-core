/**
 * Clock Capability
 * 
 * Interface for time-related operations.
 * This is an effect boundary - allows testing with controlled time.
 */

import { Context, Effect } from "effect";

/**
 * Service interface for time operations
 */
export interface Clock {
  /**
   * Get the current timestamp as ISO 8601 string
   */
  readonly now: () => Effect.Effect<string, never>;

  /**
   * Get the current timestamp as Unix milliseconds
   */
  readonly nowMs: () => Effect.Effect<number, never>;

  /**
   * Get a timestamp N seconds in the future
   */
  readonly futureSeconds: (seconds: number) => Effect.Effect<string, never>;

  /**
   * Get a timestamp N minutes in the future
   */
  readonly futureMinutes: (minutes: number) => Effect.Effect<string, never>;

  /**
   * Check if a timestamp has passed
   */
  readonly isPast: (isoTimestamp: string) => Effect.Effect<boolean, never>;
}

/**
 * Effect Context Tag for Clock
 */
export const Clock = Context.GenericTag<Clock>("@decagon/core/Clock");

/**
 * Type helper for the Clock service
 */
export type ClockService = Context.Tag.Service<typeof Clock>;
