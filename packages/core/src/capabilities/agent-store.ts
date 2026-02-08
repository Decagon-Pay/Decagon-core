/**
 * AgentStore Capability
 * 
 * Manages agent tokens for automated/AI access.
 * Agents have their own scoped policies separate from users.
 */

import { Context, Effect } from "effect";
import type { Agent, SpendPolicy, ApiError } from "@decagon/x402";

export interface AgentStore {
  /** Create a new agent with the given policy */
  readonly createAgent: (
    userId: string,
    name: string,
    policy: SpendPolicy
  ) => Effect.Effect<Agent, ApiError>;

  /** Get an agent by its token */
  readonly getAgentByToken: (agentToken: string) => Effect.Effect<Agent, ApiError>;

  /** Get an agent by its ID */
  readonly getAgentById: (agentId: string) => Effect.Effect<Agent, ApiError>;

  /** List all agents for a user */
  readonly listAgentsByUser: (userId: string) => Effect.Effect<readonly Agent[], ApiError>;

  /** Update the last used timestamp for an agent */
  readonly updateLastUsed: (agentId: string) => Effect.Effect<Agent, ApiError>;

  /** Delete an agent */
  readonly deleteAgent: (agentId: string) => Effect.Effect<void, ApiError>;
}

export const AgentStore = Context.GenericTag<AgentStore>("@decagon/core/AgentStore");
export type AgentStoreService = Context.Tag.Service<typeof AgentStore>;
