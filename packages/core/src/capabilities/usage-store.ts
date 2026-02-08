/**
 * UsageStore Capability
 * 
 * Tracks daily spending for policy enforcement.
 * Used to enforce daily caps on users and agents.
 */

import { Context, Effect } from "effect";
import type { ApiError } from "@decagon/x402";

export interface UsageStore {
  /** 
   * Get the daily spend in cents for a subject.
   * @param subjectId - Either "user:<userId>" or "agent:<agentId>"
   * @param dayKey - Date key in format "YYYY-MM-DD"
   */
  readonly getDailySpendCents: (
    subjectId: string,
    dayKey: string
  ) => Effect.Effect<number, ApiError>;

  /**
   * Add spend amount to a subject's daily total.
   * @param subjectId - Either "user:<userId>" or "agent:<agentId>"
   * @param dayKey - Date key in format "YYYY-MM-DD"
   * @param amountCents - Amount to add in cents
   */
  readonly addSpendCents: (
    subjectId: string,
    dayKey: string,
    amountCents: number
  ) => Effect.Effect<void, ApiError>;

  /**
   * Reset daily spend for a subject (for testing).
   */
  readonly resetDailySpend: (
    subjectId: string,
    dayKey: string
  ) => Effect.Effect<void, ApiError>;
}

export const UsageStore = Context.GenericTag<UsageStore>("@decagon/core/UsageStore");
export type UsageStoreService = Context.Tag.Service<typeof UsageStore>;
