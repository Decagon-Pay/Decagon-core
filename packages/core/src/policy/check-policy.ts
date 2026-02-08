/**
 * Policy Enforcement - Pure Functions
 * 
 * These are pure functions for policy checking.
 * No I/O, no effects - just deterministic logic.
 */

import type { SpendPolicy, PolicyViolationError, PolicyCheckResult } from "@decagon/x402";

export interface PolicyCheckInput {
  /** Amount being spent in cents */
  readonly amountCents: number;
  
  /** Origin of the request (e.g., "http://localhost:3000") */
  readonly origin?: string;
  
  /** Path being accessed (e.g., "/article/article-1") */
  readonly path?: string;
  
  /** Current daily spend in cents (must be looked up before calling) */
  readonly currentDailySpendCents: number;
  
  /** Subject type ("user" or "agent") */
  readonly subjectType: "user" | "agent";
  
  /** Subject ID */
  readonly subjectId: string;
}

/**
 * Check if a path matches an allowlist pattern.
 * Supports wildcards: "*" matches any single segment, "**" matches any number of segments.
 */
export function pathMatches(path: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (pattern === path) return true;
  
  // Handle /article/* style patterns
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2);
    if (path.startsWith(prefix)) {
      const remainder = path.slice(prefix.length);
      // Must be exactly one more segment (e.g., "/article-1" but not "/article/1/extra")
      return remainder.startsWith("/") && !remainder.slice(1).includes("/");
    }
  }
  
  // Handle /article/** style patterns (match any depth)
  if (pattern.endsWith("/**")) {
    const prefix = pattern.slice(0, -3);
    return path.startsWith(prefix);
  }
  
  return false;
}

/**
 * Check if an origin matches an allowlist pattern.
 */
export function originMatches(origin: string, pattern: string): boolean {
  if (pattern === "*") return true;
  return origin === pattern || origin.startsWith(pattern);
}

/**
 * Pure policy check function.
 * Returns either an allowed result or a PolicyViolationError.
 */
export function checkPolicy(
  policy: SpendPolicy,
  input: PolicyCheckInput
): PolicyCheckResult {
  const { amountCents, origin, path, currentDailySpendCents, subjectType, subjectId } = input;
  const timestamp = new Date().toISOString();
  
  // Check max per action
  if (amountCents > policy.maxPerActionCents) {
    return {
      allowed: false,
      error: {
        _tag: "PolicyViolationError",
        message: `Amount ${amountCents} cents exceeds max per action limit of ${policy.maxPerActionCents} cents`,
        timestamp,
        reason: "max_per_action",
        limit: policy.maxPerActionCents,
        attempted: amountCents,
        subjectType,
        subjectId,
      },
    };
  }
  
  // Check daily cap
  const projectedDailySpend = currentDailySpendCents + amountCents;
  if (projectedDailySpend > policy.dailyCapCents) {
    return {
      allowed: false,
      error: {
        _tag: "PolicyViolationError",
        message: `Projected daily spend ${projectedDailySpend} cents exceeds daily cap of ${policy.dailyCapCents} cents`,
        timestamp,
        reason: "daily_cap",
        limit: policy.dailyCapCents,
        attempted: projectedDailySpend,
        subjectType,
        subjectId,
      },
    };
  }
  
  // Check origin allowlist
  if (origin && policy.allowedOrigins.length > 0) {
    const originAllowed = policy.allowedOrigins.some(p => originMatches(origin, p));
    if (!originAllowed) {
      return {
        allowed: false,
        error: {
          _tag: "PolicyViolationError",
          message: `Origin "${origin}" is not in the allowed origins list`,
          timestamp,
          reason: "origin_blocked",
          limit: 0,
          attempted: 0,
          subjectType,
          subjectId,
        },
      };
    }
  }
  
  // Check path allowlist
  if (path && policy.allowedPaths.length > 0) {
    const pathAllowed = policy.allowedPaths.some(p => pathMatches(path, p));
    if (!pathAllowed) {
      return {
        allowed: false,
        error: {
          _tag: "PolicyViolationError",
          message: `Path "${path}" is not in the allowed paths list`,
          timestamp,
          reason: "path_blocked",
          limit: 0,
          attempted: 0,
          subjectType,
          subjectId,
        },
      };
    }
  }
  
  // All checks passed - determine if confirmation is needed
  const needsConfirm = amountCents > policy.requireConfirmAboveCents;
  
  return {
    allowed: true,
    needsConfirm,
  };
}

/**
 * Check if amount qualifies for auto-approval.
 */
export function canAutoApprove(policy: SpendPolicy, amountCents: number): boolean {
  return amountCents <= policy.autoApproveUnderCents;
}

/**
 * Get today's date key for usage tracking.
 */
export function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * Create a subject ID string for usage tracking.
 */
export function makeSubjectId(type: "user" | "agent", id: string): string {
  return `${type}:${id}`;
}
