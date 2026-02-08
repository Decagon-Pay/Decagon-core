/**
 * Get Article Workflow
 * 
 * HTTP 402 payment flow:
 * - No session token → 402 with PaymentChallenge
 * - Expired session → 402 with PaymentChallenge
 * - Insufficient credits → 402 with PaymentChallenge  
 * - Valid session with credits → Consume 1 credit, return full content
 */

import { Effect, pipe } from "effect";
import type { Article, ArticleResponse, ApiError, PaymentChallenge, PaymentRequiredError, SessionExpiredError } from "@decagon/x402";
import { CREDITS_PER_UNLOCK, TOPUP_CREDITS, TOPUP_PRICE_CENTS, CHALLENGE_EXPIRY_MINUTES } from "@decagon/x402";
import { ArticlesStore, ReceiptsStore, ChallengesStore, Clock, IdGen, Logger, ChainConfigService } from "../capabilities/index.js";

export interface GetArticleInput {
  readonly articleId: string;
  readonly sessionTokenId?: string;
}

type AllCapabilities = ArticlesStore | ReceiptsStore | ChallengesStore | Clock | IdGen | Logger | ChainConfigService;

const paymentRequired = (challenge: PaymentChallenge): PaymentRequiredError => ({
  _tag: "PaymentRequiredError",
  message: "Payment required to access this content",
  timestamp: new Date().toISOString(),
  challenge,
});

const sessionExpired = (tokenId: string, expiredAt: string): SessionExpiredError => ({
  _tag: "SessionExpiredError",
  message: "Session has expired",
  timestamp: new Date().toISOString(),
  tokenId,
  expiredAt,
});

/**
 * Get article - implements HTTP 402 flow
 */
export const getArticle = (
  input: GetArticleInput
): Effect.Effect<ArticleResponse, ApiError, AllCapabilities> =>
  Effect.gen(function* () {
    const articlesStore = yield* ArticlesStore;
    const article = yield* articlesStore.getById(input.articleId);

    // No session token = return 402
    if (!input.sessionTokenId) {
      return yield* createChallengeAndFail(article);
    }

    return yield* checkSessionAndUnlock(article, input.sessionTokenId);
  });

/**
 * Create a payment challenge and fail with 402
 */
const createChallengeAndFail = (article: Article): Effect.Effect<never, ApiError, AllCapabilities> =>
  Effect.gen(function* () {
    const idGen = yield* IdGen;
    const clock = yield* Clock;
    const challengesStore = yield* ChallengesStore;
    const chainConfig = yield* ChainConfigService;

    const challengeId = yield* idGen.challengeId();
    const now = yield* clock.now();
    const expiresAt = yield* clock.futureMinutes(CHALLENGE_EXPIRY_MINUTES);
    const config = yield* chainConfig.getConfig();

    const challenge: PaymentChallenge = {
      challengeId,
      resourceId: article.id,
      amountRequired: TOPUP_PRICE_CENTS,
      currency: "USDT",
      chain: config.chainName,
      description: `Unlock: ${article.title}`,
      payTo: config.payeeAddress,
      expiresAt,
      createdAt: now,
      creditsOffered: TOPUP_CREDITS,
      status: "pending",
      chainId: config.chainId,
      assetType: config.assetType,
      assetSymbol: config.assetSymbol,
      amountWei: config.topupPriceWei,
      payeeAddress: config.payeeAddress,
      explorerTxBase: config.explorerTxBase,
    };

    yield* challengesStore.save(challenge);
    return yield* Effect.fail(paymentRequired(challenge));
  });

/**
 * Check session validity and unlock content if authorized
 */
const checkSessionAndUnlock = (
  article: Article, 
  tokenId: string
): Effect.Effect<ArticleResponse, ApiError, AllCapabilities> =>
  Effect.gen(function* () {
    const receiptsStore = yield* ReceiptsStore;
    const clock = yield* Clock;
    const logger = yield* Logger;

    // Try to get session, if not found create challenge
    const sessionResult = yield* Effect.either(receiptsStore.getSession(tokenId));
    
    if (sessionResult._tag === "Left") {
      // Session not found, create challenge
      return yield* createChallengeAndFail(article);
    }
    
    const session = sessionResult.right;
    const expired = yield* clock.isPast(session.expiresAt);

    if (expired) {
      return yield* Effect.fail(sessionExpired(tokenId, session.expiresAt));
    }

    if (session.credits < CREDITS_PER_UNLOCK) {
      // Not enough credits - create new challenge
      return yield* createChallengeAndFail(article);
    }

    // Consume credits and return full content
    yield* receiptsStore.consumeCredits(tokenId, CREDITS_PER_UNLOCK);
    yield* logger.info("Credits consumed", { tokenId, credits: CREDITS_PER_UNLOCK });

    return {
      article,
      hasFullAccess: true,
      content: `${article.preview}\n\n---\n\n${article.premiumContent}`,
    };
  });

/**
 * List all articles (preview only, no auth required)
 */
export const listArticles = (): Effect.Effect<
  readonly ArticleResponse[],
  ApiError,
  ArticlesStore | Logger
> =>
  pipe(
    Effect.flatMap(ArticlesStore, (store) => store.listAll()),
    Effect.map((articles) =>
      articles.map((article): ArticleResponse => ({
        article,
        hasFullAccess: false,
        content: article.preview,
      }))
    )
  );
