/**
 * Create Payment Challenge Workflow
 * 
 * Pure workflow for creating a payment challenge when content requires payment.
 */

import { Effect, pipe } from "effect";
import type { PaymentChallenge, Article, ApiError } from "@decagon/x402";
import { ArticlesStore, Clock, IdGen, Logger } from "../capabilities/index.js";

/**
 * Input for createPaymentChallenge workflow
 */
export interface CreatePaymentChallengeInput {
  /** Article ID that requires payment */
  readonly articleId: string;

  /** Optional: how long the challenge should be valid (seconds) */
  readonly validitySeconds?: number;
}

/**
 * Default challenge validity: 10 minutes
 */
const DEFAULT_VALIDITY_SECONDS = 600;

/**
 * Mock payment recipient address (placeholder for Plasma address)
 */
const PAYMENT_RECIPIENT = "0xDecagon_Treasury_Placeholder";

/**
 * Create payment challenge workflow
 * 
 * This is a pure Effect workflow that:
 * 1. Verifies the article exists
 * 2. Generates a unique challenge ID
 * 3. Creates a challenge with expiration
 * 
 * No side effects - all I/O through capability interfaces.
 */
export const createPaymentChallenge = (
  input: CreatePaymentChallengeInput
): Effect.Effect<
  PaymentChallenge,
  ApiError,
  ArticlesStore | Clock | IdGen | Logger
> =>
  pipe(
    // Log the request
    Effect.flatMap(Logger, (logger) =>
      logger.info("Creating payment challenge", { articleId: input.articleId })
    ),

    // Fetch the article to get price info
    Effect.flatMap(() =>
      Effect.flatMap(ArticlesStore, (store) => store.getById(input.articleId))
    ),

    // Generate challenge with all required data
    Effect.flatMap((article: Article) =>
      Effect.all({
        article: Effect.succeed(article),
        challengeId: Effect.flatMap(IdGen, (idGen) => idGen.challengeId()),
        createdAt: Effect.flatMap(Clock, (clock) => clock.now()),
        expiresAt: Effect.flatMap(Clock, (clock) =>
          clock.futureSeconds(input.validitySeconds ?? DEFAULT_VALIDITY_SECONDS)
        ),
      })
    ),

    // Construct the PaymentChallenge
    Effect.map(({ article, challengeId, createdAt, expiresAt }): PaymentChallenge => ({
      challengeId,
      resourceId: article.id,
      amountRequired: article.price,
      currency: article.currency,
      description: `Unlock: ${article.title}`,
      payTo: PAYMENT_RECIPIENT,
      expiresAt,
      createdAt,
    })),

    // Log success
    Effect.tap((challenge) =>
      Effect.flatMap(Logger, (logger) =>
        logger.info("Payment challenge created", {
          challengeId: challenge.challengeId,
          resourceId: challenge.resourceId,
          amount: challenge.amountRequired,
          currency: challenge.currency,
        })
      )
    )
  );
