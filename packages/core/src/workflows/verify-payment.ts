/**
 * Verify Payment and Issue Session Workflow - Step 2
 * 
 * Flow:
 * 1. Validate challenge exists and is not expired
 * 2. Verify payment proof (mock for now)
 * 3. Mark challenge as paid
 * 4. Create receipt with credits purchased
 * 5. Create or update session with credits
 * 6. Return session token
 */

import { Effect, pipe } from "effect";
import type { Receipt, SessionToken, ApiError, InvalidPaymentError, VerifyRequest, VerifyResponse } from "@decagon/x402";
import { TOPUP_CREDITS, SESSION_EXPIRY_HOURS } from "@decagon/x402";
import { 
  ReceiptsStore, 
  ChallengesStore,
  Clock, 
  IdGen, 
  Logger, 
  PaymentVerifier,
  type PaymentProof 
} from "../capabilities/index.js";

export interface VerifyPaymentInput {
  readonly challengeId: string;
  readonly transactionRef: string;
  readonly payerAddress: string;
  /** Existing session token to add credits to (optional) */
  readonly existingSessionTokenId?: string;
}

export interface VerifyPaymentOutput {
  readonly receipt: Receipt;
  readonly sessionToken: SessionToken;
}

const invalidPayment = (challengeId: string, reason: string): InvalidPaymentError => ({
  _tag: "InvalidPaymentError",
  message: `Invalid payment: ${reason}`,
  timestamp: new Date().toISOString(),
  reason,
  challengeId,
});

/**
 * Verify payment and issue/update session with credits
 */
export const verifyPaymentAndIssueSession = (
  input: VerifyPaymentInput
): Effect.Effect<
  VerifyPaymentOutput,
  ApiError,
  ReceiptsStore | ChallengesStore | Clock | IdGen | Logger | PaymentVerifier
> =>
  pipe(
    // Get and validate challenge
    Effect.flatMap(ChallengesStore, (store) => store.get(input.challengeId)),
    Effect.flatMap((challenge) =>
      Effect.flatMap(Clock, (clock) => clock.isPast(challenge.expiresAt)).pipe(
        Effect.flatMap((isExpired) => {
          if (isExpired) {
            return Effect.fail(invalidPayment(input.challengeId, "Challenge has expired"));
          }
          if (challenge.status !== "pending") {
            return Effect.fail(invalidPayment(input.challengeId, `Challenge already ${challenge.status}`));
          }
          return Effect.succeed(challenge);
        })
      )
    ),

    // Check for double-spending
    Effect.tap(() =>
      Effect.flatMap(PaymentVerifier, (verifier) =>
        verifier.isTransactionUsed(input.transactionRef)
      ).pipe(
        Effect.flatMap((isUsed) =>
          isUsed
            ? Effect.fail(invalidPayment(input.challengeId, "Transaction already used"))
            : Effect.succeed(undefined)
        )
      )
    ),

    // Verify the payment (mock for now)
    Effect.flatMap((challenge) =>
      Effect.flatMap(PaymentVerifier, (verifier) =>
        verifier.verify(challenge, {
          transactionRef: input.transactionRef,
          payerAddress: input.payerAddress,
          chain: challenge.chain,
        })
      ).pipe(
        Effect.flatMap((result) =>
          result.valid
            ? Effect.succeed({ challenge, result })
            : Effect.fail(invalidPayment(input.challengeId, result.errorMessage ?? "Verification failed"))
        )
      )
    ),

    // Mark challenge as paid and transaction as used
    Effect.tap(({ challenge }) =>
      Effect.all([
        Effect.flatMap(ChallengesStore, (store) => store.markPaid(challenge.challengeId)),
        Effect.flatMap(PaymentVerifier, (verifier) => verifier.markTransactionUsed(input.transactionRef)),
      ])
    ),

    // Generate IDs and create receipt + session
    Effect.flatMap(({ challenge, result }) =>
      Effect.all({
        receiptId: Effect.flatMap(IdGen, (idGen) => idGen.receiptId()),
        sessionTokenId: input.existingSessionTokenId 
          ? Effect.succeed(input.existingSessionTokenId)
          : Effect.flatMap(IdGen, (idGen) => idGen.sessionTokenId()),
        now: Effect.flatMap(Clock, (clock) => clock.now()),
        sessionExpiry: Effect.flatMap(Clock, (clock) => clock.futureHours(SESSION_EXPIRY_HOURS)),
        challenge: Effect.succeed(challenge),
        verifiedAmount: Effect.succeed(result.verifiedAmount),
      })
    ),

    // Create receipt and session
    Effect.flatMap(({ receiptId, sessionTokenId, now, sessionExpiry, challenge, verifiedAmount }) => {
      const receipt: Receipt = {
        receiptId,
        challengeId: challenge.challengeId,
        resourceId: challenge.resourceId,
        amountPaid: verifiedAmount,
        currency: challenge.currency,
        transactionRef: input.transactionRef,
        verifiedAt: now,
        expiresAt: sessionExpiry,
        creditsPurchased: TOPUP_CREDITS,
        status: "confirmed",
      };

      const sessionToken: SessionToken = {
        tokenId: sessionTokenId,
        credits: TOPUP_CREDITS,
        currency: challenge.currency,
        createdAt: now,
        expiresAt: sessionExpiry,
        accessCount: 0,
      };

      return Effect.succeed({ receipt, sessionToken, isNewSession: !input.existingSessionTokenId });
    }),

    // Persist receipt and session
    Effect.tap(({ receipt }) =>
      Effect.flatMap(ReceiptsStore, (store) => store.saveReceipt(receipt))
    ),
    Effect.tap(({ sessionToken, isNewSession }) =>
      isNewSession
        ? Effect.flatMap(ReceiptsStore, (store) => store.saveSession(sessionToken))
        : Effect.flatMap(ReceiptsStore, (store) =>
            // Add credits to existing session
            store.addCredits(sessionToken.tokenId, TOPUP_CREDITS)
          )
    ),

    // Log success
    Effect.tap(({ receipt, sessionToken }) =>
      Effect.flatMap(Logger, (logger) =>
        logger.info("Payment verified, session updated", {
          receiptId: receipt.receiptId,
          sessionTokenId: sessionToken.tokenId,
          credits: sessionToken.credits,
        })
      )
    ),

    // Return only receipt and sessionToken
    Effect.map(({ receipt, sessionToken }) => ({ receipt, sessionToken }))
  );

/**
 * Get current balance for a session
 */
export const getBalance = (
  sessionTokenId: string
): Effect.Effect<
  { credits: number; expiresAt: string },
  ApiError,
  ReceiptsStore | Clock
> =>
  pipe(
    Effect.flatMap(ReceiptsStore, (store) => store.getSession(sessionTokenId)),
    Effect.map((session) => ({
      credits: session.credits,
      expiresAt: session.expiresAt,
    }))
  );
