/**
 * Verify Payment and Issue Session Workflow
 * 
 * Flow:
 * 1. Idempotency check: if receipt already exists for this txHash, return it
 * 2. Validate challenge exists and is not expired
 * 3. Verify payment proof (via RPC for on-chain, mock fallback)
 * 4. Mark challenge as paid
 * 5. Create receipt with credits purchased (including on-chain fields)
 * 6. Create or update session with credits
 * 7. Return session token
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
  /** Blockchain transaction hash for on-chain verification */
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
 * Verify payment and issue/update session with credits.
 * 
 * IDEMPOTENT: calling twice with the same txHash returns the same receipt
 * without minting additional credits.
 */
export const verifyPaymentAndIssueSession = (
  input: VerifyPaymentInput
): Effect.Effect<
  VerifyPaymentOutput,
  ApiError,
  ReceiptsStore | ChallengesStore | Clock | IdGen | Logger | PaymentVerifier
> =>
  Effect.gen(function* () {
    const receiptsStore = yield* ReceiptsStore;
    const challengesStore = yield* ChallengesStore;
    const clock = yield* Clock;
    const idGen = yield* IdGen;
    const logger = yield* Logger;
    const paymentVerifier = yield* PaymentVerifier;

    const txRef = input.txHash || input.transactionRef;
    if (!txRef) {
      return yield* Effect.fail(invalidPayment(input.challengeId, "No transaction reference provided"));
    }

    // ── Step 1: Idempotency check ──────────────────────────────────
    // If we already issued a receipt for this txRef, return it without
    // minting any additional credits.
    const existingReceipt = yield* receiptsStore.getReceiptByTxRef(txRef);
    if (existingReceipt) {
      yield* logger.info("[verify] idempotency hit, returning existing receipt", {
        txRef,
        receiptId: existingReceipt.receiptId,
        challengeId: existingReceipt.challengeId,
      });
      // Try to resolve the caller's session on the server.
      const sessionTokenId = input.existingSessionTokenId || existingReceipt.receiptId;
      const sessionResult = yield* Effect.either(
        receiptsStore.getSession(input.existingSessionTokenId ?? "")
      );

      let session: SessionToken;
      if (sessionResult._tag === "Right") {
        session = sessionResult.right;
      } else {
        // Session was lost (server restart, mock mode, etc.).
        // Re-create it so the caller can actually use the token.
        session = {
          tokenId: sessionTokenId,
          credits: existingReceipt.creditsPurchased,
          currency: existingReceipt.currency,
          createdAt: existingReceipt.verifiedAt,
          expiresAt: existingReceipt.expiresAt,
          accessCount: 0,
        };
        yield* receiptsStore.saveSession(session);
        yield* logger.info("[verify] idempotency: re-created missing session", {
          sessionTokenId,
          credits: session.credits,
        });
      }
      return { receipt: existingReceipt, sessionToken: session };
    }

    // ── Step 2: Validate challenge ─────────────────────────────────
    const challenge = yield* challengesStore.get(input.challengeId);

    // If challenge is already paid, check if there's a receipt for it
    // (another request might have just beaten us).
    if (challenge.status === "paid") {
      const hasReceipt = yield* receiptsStore.hasReceiptForChallenge(challenge.challengeId);
      if (hasReceipt) {
        yield* logger.info("[verify] challenge already paid, looking up existing receipt", {
          challengeId: challenge.challengeId, txRef,
        });
        // The challenge was already fulfilled. Try to find the existing receipt
        // and return it so the client gets a usable session instead of a dead-end.
        const existingByChallenge = yield* Effect.either(
          receiptsStore.getReceiptByChallenge(challenge.challengeId)
        );
        if (existingByChallenge._tag === "Right") {
          const rec = existingByChallenge.right;
          const sessionTokenId = input.existingSessionTokenId || rec.receiptId;
          const sessionResult = yield* Effect.either(
            receiptsStore.getSession(sessionTokenId)
          );
          let session: SessionToken;
          if (sessionResult._tag === "Right") {
            session = sessionResult.right;
          } else {
            session = {
              tokenId: sessionTokenId,
              credits: rec.creditsPurchased,
              currency: rec.currency,
              createdAt: rec.verifiedAt,
              expiresAt: rec.expiresAt,
              accessCount: 0,
            };
            yield* receiptsStore.saveSession(session);
          }
          return { receipt: rec, sessionToken: session };
        }
        return yield* Effect.fail(invalidPayment(input.challengeId, "Challenge already paid"));
      }
    }

    const isExpired = yield* clock.isPast(challenge.expiresAt);
    if (isExpired) {
      return yield* Effect.fail(invalidPayment(input.challengeId, "Challenge has expired"));
    }
    if (challenge.status !== "pending") {
      return yield* Effect.fail(invalidPayment(input.challengeId, `Challenge already ${challenge.status}`));
    }

    // ── Step 3: Double-spend guard on txRef ────────────────────────
    const isUsed = yield* paymentVerifier.isTransactionUsed(txRef);
    if (isUsed) {
      return yield* Effect.fail(invalidPayment(input.challengeId, "Transaction already used"));
    }

    // ── Step 4: Verify on-chain / mock ─────────────────────────────
    yield* logger.info("[verify] start", { challengeId: input.challengeId, txRef });

    const verificationResult = yield* paymentVerifier.verify(challenge, {
      transactionRef: txRef,
      txHash: input.txHash,
      payerAddress: input.payerAddress || "",
      chain: challenge.chain,
    });

    if (!verificationResult.valid) {
      return yield* Effect.fail(
        invalidPayment(input.challengeId, verificationResult.errorMessage ?? "Verification failed")
      );
    }

    // ── Step 5: Mark paid + used (atomically) ──────────────────────
    yield* challengesStore.markPaid(challenge.challengeId);
    yield* paymentVerifier.markTransactionUsed(txRef);

    // ── Step 6: Build receipt + session ─────────────────────────────
    const receiptId = yield* idGen.receiptId();
    const sessionTokenId = input.existingSessionTokenId
      ? input.existingSessionTokenId
      : yield* idGen.sessionTokenId();
    const now = yield* clock.now();
    const sessionExpiry = yield* clock.futureHours(SESSION_EXPIRY_HOURS);

    const receipt: Receipt = {
      receiptId,
      challengeId: challenge.challengeId,
      resourceId: challenge.resourceId,
      amountPaid: verificationResult.verifiedAmount,
      currency: challenge.currency,
      transactionRef: txRef,
      verifiedAt: now,
      expiresAt: sessionExpiry,
      creditsPurchased: TOPUP_CREDITS,
      status: "confirmed",
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

    // ── Step 7: Persist receipt + session (exactly-once) ───────────
    yield* receiptsStore.saveReceipt(receipt);

    let finalSessionToken = sessionToken;

    if (input.existingSessionTokenId) {
      // Check whether the existing session is still valid on the server.
      // It may have been lost (server restart in mock mode, DB reset, etc.).
      const existing = yield* Effect.either(
        receiptsStore.getSession(input.existingSessionTokenId)
      );

      if (existing._tag === "Right") {
        // Session exists → add credits and return actual total
        const updated = yield* receiptsStore.addCredits(input.existingSessionTokenId, TOPUP_CREDITS);
        finalSessionToken = {
          ...sessionToken,
          credits: updated.credits,
        };
        yield* logger.info("[verify] credits added to existing session", {
          sessionTokenId: input.existingSessionTokenId,
          creditsBefore: existing.right.credits,
          creditsAdded: TOPUP_CREDITS,
          creditsAfter: updated.credits,
        });
      } else {
        // Session not found on server → fall back to creating a new session
        // instead of crashing on addCredits (which would leave the system in
        // an inconsistent state: challenge paid + receipt saved but no session).
        yield* receiptsStore.saveSession(sessionToken);
        yield* logger.info("[verify] existing session not found, created new session", {
          sessionTokenId: sessionToken.tokenId,
          credits: TOPUP_CREDITS,
        });
      }
    } else {
      yield* receiptsStore.saveSession(sessionToken);
      yield* logger.info("[verify] new session created", {
        sessionTokenId: sessionToken.tokenId,
        credits: TOPUP_CREDITS,
      });
    }

    yield* logger.info("[verify] complete", {
      receiptId: receipt.receiptId,
      txRef,
      sessionTokenId,
    });

    return { receipt, sessionToken: finalSessionToken };
  });

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
