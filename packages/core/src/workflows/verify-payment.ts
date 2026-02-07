/**
 * Verify Payment and Issue Session Workflow - Step 4
 * 
 * Flow:
 * 1. Validate challenge exists and is not expired
 * 2. Verify payment proof (via RPC for on-chain, mock fallback)
 * 3. Mark challenge as paid
 * 4. Create receipt with credits purchased (including on-chain fields)
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
  /** Legacy transaction reference (for mock payments) */
  readonly transactionRef?: string;
  /** Step 4: Actual blockchain transaction hash */
  readonly txHash?: string;
  readonly payerAddress?: string;
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

    // Check for double-spending using txHash or transactionRef
    Effect.tap(() => {
      const txRef = input.txHash || input.transactionRef;
      if (!txRef) {
        return Effect.fail(invalidPayment(input.challengeId, "No transaction reference provided"));
      }
      return Effect.flatMap(PaymentVerifier, (verifier) =>
        verifier.isTransactionUsed(txRef)
      ).pipe(
        Effect.flatMap((isUsed) =>
          isUsed
            ? Effect.fail(invalidPayment(input.challengeId, "Transaction already used"))
            : Effect.succeed(undefined)
        )
      );
    }),

    // Verify the payment (mock for legacy, RPC for txHash)
    Effect.flatMap((challenge) =>
      Effect.flatMap(PaymentVerifier, (verifier) =>
        verifier.verify(challenge, {
          transactionRef: input.txHash || input.transactionRef || "",
          txHash: input.txHash,
          payerAddress: input.payerAddress || "",
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
    Effect.tap(({ challenge }) => {
      const txRef = input.txHash || input.transactionRef || "";
      return Effect.all([
        Effect.flatMap(ChallengesStore, (store) => store.markPaid(challenge.challengeId)),
        Effect.flatMap(PaymentVerifier, (verifier) => verifier.markTransactionUsed(txRef)),
      ]);
    }),

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
        verificationResult: Effect.succeed(result),
      })
    ),

    // Create receipt and session
    Effect.flatMap(({ receiptId, sessionTokenId, now, sessionExpiry, challenge, verificationResult }) => {
      const receipt: Receipt = {
        receiptId,
        challengeId: challenge.challengeId,
        resourceId: challenge.resourceId,
        amountPaid: verificationResult.verifiedAmount,
        currency: challenge.currency,
        transactionRef: input.txHash || input.transactionRef || "",
        verifiedAt: now,
        expiresAt: sessionExpiry,
        creditsPurchased: TOPUP_CREDITS,
        status: "confirmed",
        // Step 4: On-chain fields
        txHash: verificationResult.txHash || input.txHash,
        explorerUrl: verificationResult.explorerUrl || 
          (input.txHash ? `${challenge.explorerTxBase}${input.txHash}` : undefined),
        blockNumber: verificationResult.blockNumber,
        amountNative: verificationResult.amountNative,
        payerAddress: verificationResult.payerAddress || input.payerAddress,
        payeeAddress: verificationResult.payeeAddress || challenge.payeeAddress,
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
