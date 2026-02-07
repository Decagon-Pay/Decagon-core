/**
 * @decagon/x402 - HTTP 402 Protocol Types
 * 
 * This package defines the core protocol types for Decagon's
 * pay-per-use payment layer. No implementation, types only.
 */

// ============================================
// Constants
// ============================================

export const CREDITS_PER_UNLOCK = 1;
export const TOPUP_CREDITS = 100;
export const TOPUP_PRICE_CENTS = 50;
export const SESSION_EXPIRY_HOURS = 24;
export const CHALLENGE_EXPIRY_MINUTES = 10;

// ============================================
// Payment Challenge (sent with 402 response)
// ============================================

/**
 * Represents a payment challenge returned when content requires payment.
 * The client must satisfy this challenge to access the resource.
 */
export interface PaymentChallenge {
  readonly challengeId: string;
  readonly resourceId: string;
  readonly amountRequired: number;
  readonly currency: string;
  readonly chain: string;
  readonly description: string;
  readonly payTo: string;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly creditsOffered: number;
  readonly status: "pending" | "paid" | "expired";
}

// ============================================
// Payment Required Response (HTTP 402 body)
// ============================================

/**
 * The response body returned with HTTP 402 Payment Required.
 * Contains the challenge and optional preview content.
 */
export interface PaymentRequiredResponse {
  /** HTTP status code (always 402) */
  readonly status: 402;

  /** Human-readable error message */
  readonly message: string;

  /** The payment challenge to satisfy */
  readonly challenge: PaymentChallenge;

  /** Optional preview content (e.g., article excerpt) */
  readonly preview?: ContentPreview;

  /** Available payment methods */
  readonly acceptedPaymentMethods: readonly PaymentMethod[];
}

/**
 * Preview content shown before payment
 */
export interface ContentPreview {
  /** Preview text or excerpt */
  readonly text: string;

  /** Whether more content is available after payment */
  readonly hasMore: boolean;

  /** Percentage of content available in preview (0-100) */
  readonly previewPercent: number;
}

/**
 * Supported payment method
 */
export interface PaymentMethod {
  /** Payment method identifier */
  readonly type: "plasma" | "session_credit";

  /** Human-readable name */
  readonly name: string;

  /** Whether this method is currently available */
  readonly available: boolean;
}

// ============================================
// Receipt (proof of payment)
// ============================================

/**
 * Receipt issued after successful payment verification.
 * Serves as proof that payment was made.
 */
export interface Receipt {
  readonly receiptId: string;
  readonly challengeId: string;
  readonly resourceId: string;
  readonly amountPaid: number;
  readonly currency: string;
  readonly transactionRef: string;
  readonly verifiedAt: string;
  readonly expiresAt: string;
  readonly creditsPurchased: number;
  readonly status: "confirmed" | "pending";
}

// ============================================
// Session Token (prepaid credits)
// ============================================

/**
 * Represents prepaid credits that can be used to access content
 * without individual payment transactions.
 */
export interface SessionToken {
  readonly tokenId: string;
  readonly credits: number;
  readonly currency: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly accessCount: number;
}

export interface BalanceResponse {
  readonly creditsRemaining: number;
  readonly currency: string;
  readonly expiresAt: string;
}

export interface TopupRequest {
  readonly credits?: number;
  readonly plan?: "starter" | "pro";
}

export interface VerifyRequest {
  readonly challengeId: string;
  readonly txHash?: string;
}

export interface VerifyResponse {
  readonly receipt: Receipt;
  readonly sessionToken: SessionToken;
  readonly creditsRemaining: number;
}

// ============================================
// API Error (union type, no throwing)
// ============================================

/**
 * Base error interface
 */
interface BaseError {
  readonly _tag: string;
  readonly message: string;
  readonly timestamp: string;
}

/**
 * Resource not found error
 */
export interface NotFoundError extends BaseError {
  readonly _tag: "NotFoundError";
  readonly resourceType: string;
  readonly resourceId: string;
}

/**
 * Payment required error (use with HTTP 402)
 */
export interface PaymentRequiredError extends BaseError {
  readonly _tag: "PaymentRequiredError";
  readonly challenge: PaymentChallenge;
}

/**
 * Invalid payment error
 */
export interface InvalidPaymentError extends BaseError {
  readonly _tag: "InvalidPaymentError";
  readonly reason: string;
  readonly challengeId: string;
}

/**
 * Session expired error
 */
export interface SessionExpiredError extends BaseError {
  readonly _tag: "SessionExpiredError";
  readonly tokenId: string;
  readonly expiredAt: string;
}

/**
 * Insufficient credits error
 */
export interface InsufficientCreditsError extends BaseError {
  readonly _tag: "InsufficientCreditsError";
  readonly required: number;
  readonly available: number;
  readonly currency: string;
}

/**
 * Internal error (unexpected failures)
 */
export interface InternalError extends BaseError {
  readonly _tag: "InternalError";
  readonly cause?: unknown;
}

/**
 * Validation error for malformed requests
 */
export interface ValidationError extends BaseError {
  readonly _tag: "ValidationError";
  readonly field: string;
  readonly reason: string;
}

/**
 * Policy violation error (spend limits exceeded)
 */
export interface PolicyViolationError extends BaseError {
  readonly _tag: "PolicyViolationError";
  readonly reason: "max_per_action" | "daily_cap" | "origin_blocked" | "path_blocked";
  readonly limit: number;
  readonly attempted: number;
  readonly subjectType: "user" | "agent";
  readonly subjectId: string;
}

/**
 * Agent not authorised error
 */
export interface AgentNotAuthorisedError extends BaseError {
  readonly _tag: "AgentNotAuthorisedError";
  readonly agentToken: string;
  readonly reason: string;
}

/**
 * Union type of all API errors.
 * Use discriminated union pattern with _tag for type narrowing.
 */
export type ApiError =
  | NotFoundError
  | PaymentRequiredError
  | InvalidPaymentError
  | SessionExpiredError
  | InsufficientCreditsError
  | InternalError
  | ValidationError
  | PolicyViolationError
  | AgentNotAuthorisedError;

// ============================================
// Helper type guards
// ============================================

export const isNotFoundError = (e: ApiError): e is NotFoundError =>
  e._tag === "NotFoundError";

export const isPaymentRequiredError = (e: ApiError): e is PaymentRequiredError =>
  e._tag === "PaymentRequiredError";

export const isInvalidPaymentError = (e: ApiError): e is InvalidPaymentError =>
  e._tag === "InvalidPaymentError";

export const isSessionExpiredError = (e: ApiError): e is SessionExpiredError =>
  e._tag === "SessionExpiredError";

export const isInsufficientCreditsError = (e: ApiError): e is InsufficientCreditsError =>
  e._tag === "InsufficientCreditsError";

export const isInternalError = (e: ApiError): e is InternalError =>
  e._tag === "InternalError";

export const isValidationError = (e: ApiError): e is ValidationError =>
  e._tag === "ValidationError";

export const isPolicyViolationError = (e: ApiError): e is PolicyViolationError =>
  e._tag === "PolicyViolationError";

export const isAgentNotAuthorisedError = (e: ApiError): e is AgentNotAuthorisedError =>
  e._tag === "AgentNotAuthorisedError";

// ============================================
// Spend Policy (limits + allowlists)
// ============================================

/**
 * Spend policy for users or agents.
 * Controls payment limits and allowed access patterns.
 */
export interface SpendPolicy {
  /** Maximum spend per single action (cents) */
  readonly maxPerActionCents: number;

  /** Maximum daily spend (cents) */
  readonly dailyCapCents: number;

  /** Auto-approve payments under this amount (cents) */
  readonly autoApproveUnderCents: number;

  /** Require confirmation above this amount (cents) */
  readonly requireConfirmAboveCents: number;

  /** Allowed origins (e.g., ["http://localhost:3000"]) */
  readonly allowedOrigins: readonly string[];

  /** Allowed paths (e.g., ["/article/*"]) */
  readonly allowedPaths: readonly string[];
}

/**
 * Default spend policy for new users
 */
export const DEFAULT_SPEND_POLICY: SpendPolicy = {
  maxPerActionCents: 500,        // $5 max per action
  dailyCapCents: 2000,           // $20 daily cap
  autoApproveUnderCents: 100,    // Auto-approve under $1
  requireConfirmAboveCents: 200, // Require confirm over $2
  allowedOrigins: ["*"],         // Allow all origins
  allowedPaths: ["*"],           // Allow all paths
};

// ============================================
// Agent (scoped tokens with policies)
// ============================================

/**
 * Agent token for automated/AI access.
 * Agents have their own spend policies separate from users.
 */
export interface Agent {
  readonly agentId: string;
  readonly agentToken: string;
  readonly userId: string;
  readonly policy: SpendPolicy;
  readonly name: string;
  readonly createdAt: string;
  readonly lastUsedAt?: string;
}

/**
 * Policy check result
 */
export type PolicyCheckResult = 
  | { allowed: true; needsConfirm: boolean }
  | { allowed: false; error: PolicyViolationError };

// ============================================
// Article types (for content access)
// ============================================

/**
 * Article metadata and content
 */
export interface Article {
  /** Unique article identifier */
  readonly id: string;

  /** Article title */
  readonly title: string;

  /** Author name */
  readonly author: string;

  /** Preview content (always visible) */
  readonly preview: string;

  /** Premium content (requires payment) */
  readonly premiumContent: string;

  /** Price to unlock in smallest unit */
  readonly price: number;

  /** Currency code */
  readonly currency: string;

  /** Publication date (ISO 8601) */
  readonly publishedAt: string;

  /** Estimated read time in minutes */
  readonly readTimeMinutes: number;

  /** Article tags */
  readonly tags: readonly string[];
}

/**
 * Article response with access level
 */
export interface ArticleResponse {
  /** The article data */
  readonly article: Article;

  /** Whether full content is accessible */
  readonly hasFullAccess: boolean;

  /** Content to display (preview or full) */
  readonly content: string;
}
