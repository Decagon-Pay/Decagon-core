/**
 * Verify Payment and Issue Session Workflow
 * 
 * Pure workflow for verifying payment proofs and issuing session tokens.
 */

import { Effect, pipe } from "effect";
import type { Receipt, SessionToken, PaymentChallenge, ApiError, InvalidPaymentError } from "@decagon/x402";
import { 
  ReceiptsStore, 
  Clock, 
  IdGen, 
  Logger, 
  PaymentVerifier,
  type PaymentProof 
} from "../capabilities/index.js";

/**
 * Input for verifyPaymentAndIssueSession workflow
 */
export interface VerifyPaymentInput {
  /** The challenge being satisfied */
  readonly challenge: PaymentChallenge;

  /** Proof of payment from the client */
  readonly proof: PaymentProof;
}

/**
 * Output from verifyPaymentAndIssueSession workflow
 */
export interface VerifyPaymentOutput {
  /** Receipt proving the payment */
  readonly receipt: Receipt;

  /** Session token with prepaid credits */
  readonly sessionToken: SessionToken;
}

/**
 * Default session validity: 24 hours
 */
const SESSION_VALIDITY_SECONDS = 86400;

/**
 * Create an InvalidPaymentError
 */
const invalidPayment = (challengeId: string, reason: string): InvalidPaymentError => ({
  _tag: "InvalidPaymentError",
  message: `Invalid payment: ${reason}`,
  timestamp: new Date().toISOString(),
  reason,
  challengeId,
});

/**
 * Verify payment and issue session workflow
 * 
 * This is a pure Effect workflow that:
 * 1. Checks if challenge has expired
 * 2. Verifies the payment proof
 * 3. Checks for double-spending
 * 4. Creates receipt and session token
 * 5. Persists both to store
 * 
 * No side effects - all I/O through capability interfaces.
 */
export const verifyPaymentAndIssueSession = (
  input: VerifyPaymentInput
): Effect.Effect<
  VerifyPaymentOutput,
  ApiError,
  ReceiptsStore | Clock | IdGen | Logger | PaymentVerifier
> =>
  pipe(
    // Log the request
    Effect.flatMap(Logger, (logger) =>
      logger.info("Verifying payment", {
        challengeId: input.challenge.challengeId,
        transactionRef: input.proof.transactionRef,
      })
    ),

    // Check if challenge has expired
    Effect.flatMap(() =>
      Effect.flatMap(Clock, (clock) => clock.isPast(input.challenge.expiresAt))
    ),
    Effect.flatMap((isExpired) =>
      isExpired
        ? Effect.fail(invalidPayment(input.challenge.challengeId, "Challenge has expired"))
        : Effect.succeed(undefined)
    ),

    // Check for double-spending
    Effect.flatMap(() =>
      Effect.flatMap(PaymentVerifier, (verifier) =>
        verifier.isTransactionUsed(input.proof.transactionRef)
      )
    ),
    Effect.flatMap((isUsed) =>
      isUsed
        ? Effect.fail(invalidPayment(input.challenge.challengeId, "Transaction already used"))
        : Effect.succeed(undefined)
    ),

    // Verify the payment
    Effect.flatMap(() =>
      Effect.flatMap(PaymentVerifier, (verifier) =>
        verifier.verify(input.challenge, input.proof)
      )
    ),
    Effect.flatMap((result) =>
      result.valid
        ? Effect.succeed(result)
        : Effect.fail(invalidPayment(input.challenge.challengeId, result.errorMessage ?? "Verification failed"))
    ),

    // Generate IDs and timestamps
    Effect.flatMap((verificationResult) =>
      Effect.all({
        verificationResult: Effect.succeed(verificationResult),
        receiptId: Effect.flatMap(IdGen, (idGen) => idGen.receiptId()),
        sessionTokenId: Effect.flatMap(IdGen, (idGen) => idGen.sessionTokenId()),
        now: Effect.flatMap(Clock, (clock) => clock.now()),
        sessionExpiry: Effect.flatMap(Clock, (clock) =>
          clock.futureSeconds(SESSION_VALIDITY_SECONDS)
        ),
      })
    ),

    // Create receipt and session
    Effect.flatMap(({ verificationResult, receiptId, sessionTokenId, now, sessionExpiry }) => {
      const receipt: Receipt = {
        receiptId,
        challengeId: input.challenge.challengeId,
        resourceId: input.challenge.resourceId,
        amountPaid: verificationResult.verifiedAmount,
        currency: input.challenge.currency,
        transactionRef: input.proof.transactionRef,
        verifiedAt: verificationResult.verifiedAt,
        expiresAt: sessionExpiry, // Receipt expires with session
      };

      const sessionToken: SessionToken = {
        tokenId: sessionTokenId,
        balance: verificationResult.verifiedAmount,
        currency: input.challenge.currency,
        createdAt: now,
        expiresAt: sessionExpiry,
        accessCount: 0,
      };

      return Effect.succeed({ receipt, sessionToken });
    }),

    // Mark transaction as used
    Effect.tap(({ receipt }) =>
      Effect.flatMap(PaymentVerifier, (verifier) =>
        verifier.markTransactionUsed(receipt.transactionRef)
      )
    ),

    // Persist receipt
    Effect.tap(({ receipt }) =>
      Effect.flatMap(ReceiptsStore, (store) => store.saveReceipt(receipt))
    ),

    // Persist session
    Effect.tap(({ sessionToken }) =>
      Effect.flatMap(ReceiptsStore, (store) => store.saveSession(sessionToken))
    ),

    // Log success
    Effect.tap(({ receipt, sessionToken }) =>
      Effect.flatMap(Logger, (logger) =>
        logger.info("Payment verified, session issued", {
          receiptId: receipt.receiptId,
          sessionTokenId: sessionToken.tokenId,
          balance: sessionToken.balance,
        })
      )
    )
  );

/**
 * Mock verify payment workflow for Step 1
 * 
 * Always succeeds with mock data. For demo purposes only.
 */
export const mockVerifyPayment = (
  challengeId: string,
  resourceId: string
): Effect.Effect<
  VerifyPaymentOutput,
  ApiError,
  Clock | IdGen | Logger
> =>
  pipe(
    // Log the mock request
    Effect.flatMap(Logger, (logger) =>
      logger.info("Mock payment verification", { challengeId, resourceId })
    ),

    // Generate mock IDs and timestamps
    Effect.flatMap(() =>
      Effect.all({
        receiptId: Effect.flatMap(IdGen, (idGen) => idGen.receiptId()),
        sessionTokenId: Effect.flatMap(IdGen, (idGen) => idGen.sessionTokenId()),
        now: Effect.flatMap(Clock, (clock) => clock.now()),
        sessionExpiry: Effect.flatMap(Clock, (clock) =>
          clock.futureSeconds(SESSION_VALIDITY_SECONDS)
        ),
      })
    ),

    // Create mock receipt and session
    Effect.map(({ receiptId, sessionTokenId, now, sessionExpiry }): VerifyPaymentOutput => ({
      receipt: {
        receiptId,
        challengeId,
        resourceId,
        amountPaid: 100, // Mock amount
        currency: "USD",
        transactionRef: `mock_tx_${Date.now()}`,
        verifiedAt: now,
        expiresAt: sessionExpiry,
      },
      sessionToken: {
        tokenId: sessionTokenId,
        balance: 100,
        currency: "USD",
        createdAt: now,
        expiresAt: sessionExpiry,
        accessCount: 0,
      },
    })),

    // Log success
    Effect.tap(({ receipt, sessionToken }) =>
      Effect.flatMap(Logger, (logger) =>
        logger.info("Mock payment verified", {
          receiptId: receipt.receiptId,
          sessionTokenId: sessionToken.tokenId,
        })
      )
    )
  );
