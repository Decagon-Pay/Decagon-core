/**
 * @decagon/x402 - HTTP 402 Protocol Types
 * 
 * This package defines the core protocol types for Decagon's
 * pay-per-use payment layer. No implementation, types only.
 */

// ============================================
// Payment Challenge (sent with 402 response)
// ============================================

/**
 * Represents a payment challenge returned when content requires payment.
 * The client must satisfy this challenge to access the resource.
 */
export interface PaymentChallenge {
  /** Unique identifier for this payment challenge */
  readonly challengeId: string;

  /** The resource being requested */
  readonly resourceId: string;

  /** Amount required in smallest unit (e.g., cents) */
  readonly amountRequired: number;

  /** Currency code (e.g., "USD", "PLASMA") */
  readonly currency: string;

  /** Human-readable description of what's being purchased */
  readonly description: string;

  /** Recipient address for payment (placeholder for now) */
  readonly payTo: string;

  /** Challenge expiration timestamp (ISO 8601) */
  readonly expiresAt: string;

  /** Timestamp when challenge was created (ISO 8601) */
  readonly createdAt: string;
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
  /** Unique receipt identifier */
  readonly receiptId: string;

  /** The challenge that was satisfied */
  readonly challengeId: string;

  /** The resource that was paid for */
  readonly resourceId: string;

  /** Amount that was paid */
  readonly amountPaid: number;

  /** Currency of payment */
  readonly currency: string;

  /** Transaction reference (blockchain tx hash, mock for now) */
  readonly transactionRef: string;

  /** When payment was verified (ISO 8601) */
  readonly verifiedAt: string;

  /** Receipt expiration (ISO 8601) */
  readonly expiresAt: string;
}

// ============================================
// Session Token (prepaid credits)
// ============================================

/**
 * Represents prepaid credits that can be used to access content
 * without individual payment transactions.
 */
export interface SessionToken {
  /** Unique session token identifier */
  readonly tokenId: string;

  /** Remaining credit balance */
  readonly balance: number;

  /** Currency of the balance */
  readonly currency: string;

  /** When the session was created (ISO 8601) */
  readonly createdAt: string;

  /** When the session expires (ISO 8601) */
  readonly expiresAt: string;

  /** Number of resources accessed with this session */
  readonly accessCount: number;
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
  | ValidationError;

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
