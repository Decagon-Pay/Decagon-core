/**
 * Get Article Workflow
 * 
 * Pure workflow for retrieving article content.
 * Returns full content or preview based on access rights.
 */

import { Effect, pipe } from "effect";
import type { Article, ArticleResponse, ApiError, NotFoundError } from "@decagon/x402";
import { ArticlesStore, Logger } from "../capabilities/index.js";

/**
 * Input for getArticle workflow
 */
export interface GetArticleInput {
  /** Article ID to retrieve */
  readonly articleId: string;

  /** Session token ID for checking access (optional) */
  readonly sessionTokenId?: string;
}

/**
 * Create a NotFoundError
 */
const notFound = (resourceType: string, resourceId: string): NotFoundError => ({
  _tag: "NotFoundError",
  message: `${resourceType} not found: ${resourceId}`,
  timestamp: new Date().toISOString(),
  resourceType,
  resourceId,
});

/**
 * Get article workflow
 * 
 * This is a pure Effect workflow that:
 * 1. Retrieves article from store
 * 2. Checks if user has access (via session token)
 * 3. Returns appropriate content based on access level
 * 
 * For Step 1, always returns preview (no access checking yet)
 */
export const getArticle = (
  input: GetArticleInput
): Effect.Effect<
  ArticleResponse,
  ApiError,
  ArticlesStore | Logger
> =>
  pipe(
    // Log the request
    Effect.flatMap(
      Logger,
      (logger) => logger.info("Getting article", { articleId: input.articleId })
    ),

    // Fetch the article
    Effect.flatMap(() =>
      Effect.flatMap(ArticlesStore, (store) => store.getById(input.articleId))
    ),

    // For Step 1: Always return preview content
    // In Step 2, we'll check session tokens and return full content when authorized
    Effect.map((article): ArticleResponse => ({
      article,
      hasFullAccess: false, // Always false for now
      content: article.preview, // Only preview content for now
    })),

    // Log success
    Effect.tap((response) =>
      Effect.flatMap(Logger, (logger) =>
        logger.info("Article retrieved", {
          articleId: input.articleId,
          hasFullAccess: response.hasFullAccess,
        })
      )
    )
  );

/**
 * List all articles workflow
 * 
 * Returns all available articles with preview content only.
 */
export const listArticles = (): Effect.Effect<
  readonly ArticleResponse[],
  ApiError,
  ArticlesStore | Logger
> =>
  pipe(
    // Log the request
    Effect.flatMap(Logger, (logger) => logger.info("Listing all articles")),

    // Fetch all articles
    Effect.flatMap(() =>
      Effect.flatMap(ArticlesStore, (store) => store.listAll())
    ),

    // Map to ArticleResponse (preview only)
    Effect.map((articles) =>
      articles.map((article): ArticleResponse => ({
        article,
        hasFullAccess: false,
        content: article.preview,
      }))
    ),

    // Log success
    Effect.tap((responses) =>
      Effect.flatMap(Logger, (logger) =>
        logger.info("Articles listed", { count: responses.length })
      )
    )
  );
