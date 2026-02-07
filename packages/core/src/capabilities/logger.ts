/**
 * Logger Capability
 * 
 * Interface for structured logging operations.
 * This is an effect boundary - implementations can log to console, files, services, etc.
 */

import { Context, Effect } from "effect";

/**
 * Log level type
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Structured log context
 */
export interface LogContext {
  readonly [key: string]: unknown;
}

/**
 * Service interface for logging operations
 */
export interface Logger {
  /**
   * Log a debug message
   */
  readonly debug: (
    message: string,
    context?: LogContext
  ) => Effect.Effect<void, never>;

  /**
   * Log an info message
   */
  readonly info: (
    message: string,
    context?: LogContext
  ) => Effect.Effect<void, never>;

  /**
   * Log a warning message
   */
  readonly warn: (
    message: string,
    context?: LogContext
  ) => Effect.Effect<void, never>;

  /**
   * Log an error message
   */
  readonly error: (
    message: string,
    context?: LogContext
  ) => Effect.Effect<void, never>;

  /**
   * Log with specific level
   */
  readonly log: (
    level: LogLevel,
    message: string,
    context?: LogContext
  ) => Effect.Effect<void, never>;
}

/**
 * Effect Context Tag for Logger
 */
export const Logger = Context.GenericTag<Logger>("@decagon/core/Logger");

/**
 * Type helper for the Logger service
 */
export type LoggerService = Context.Tag.Service<typeof Logger>;
