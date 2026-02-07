/**
 * Policy Workflows
 * 
 * Effectful workflows for policy management and enforcement.
 */

import { Effect } from "effect";
import type { SpendPolicy, Agent, ApiError } from "@decagon/x402";
import { DEFAULT_SPEND_POLICY } from "@decagon/x402";
import { PolicyStore, AgentStore, UsageStore } from "../capabilities/index.js";
import { checkPolicy, getTodayKey, makeSubjectId, type PolicyCheckInput } from "../policy/index.js";

// ============================================
// Policy Management Workflows
// ============================================

/**
 * Get the spend policy for a user
 */
export const getUserPolicy = (
  userId: string
): Effect.Effect<SpendPolicy, ApiError, PolicyStore> =>
  Effect.gen(function* () {
    const policyStore = yield* PolicyStore;
    return yield* policyStore.getUserPolicy(userId);
  });

/**
 * Set the spend policy for a user
 */
export const setUserPolicy = (
  userId: string,
  policy: SpendPolicy
): Effect.Effect<SpendPolicy, ApiError, PolicyStore> =>
  Effect.gen(function* () {
    const policyStore = yield* PolicyStore;
    return yield* policyStore.setUserPolicy(userId, policy);
  });

// ============================================
// Agent Management Workflows
// ============================================

/**
 * Create a new agent with the given policy
 */
export const createAgent = (input: {
  userId: string;
  name: string;
  policy: SpendPolicy;
}): Effect.Effect<Agent, ApiError, AgentStore> =>
  Effect.gen(function* () {
    const agentStore = yield* AgentStore;
    return yield* agentStore.createAgent(input.userId, input.name, input.policy);
  });

/**
 * Get an agent by its token
 */
export const getAgentByToken = (
  agentToken: string
): Effect.Effect<Agent, ApiError, AgentStore> =>
  Effect.gen(function* () {
    const agentStore = yield* AgentStore;
    return yield* agentStore.getAgentByToken(agentToken);
  });

/**
 * List all agents for a user
 */
export const listAgents = (
  userId: string
): Effect.Effect<readonly Agent[], ApiError, AgentStore> =>
  Effect.gen(function* () {
    const agentStore = yield* AgentStore;
    return yield* agentStore.listAgentsByUser(userId);
  });

/**
 * Delete an agent
 */
export const deleteAgent = (
  agentId: string
): Effect.Effect<void, ApiError, AgentStore> =>
  Effect.gen(function* () {
    const agentStore = yield* AgentStore;
    return yield* agentStore.deleteAgent(agentId);
  });

// ============================================
// Policy Enforcement Workflows
// ============================================

export interface PolicyCheckRequest {
  /** Amount being spent in cents */
  amountCents: number;
  /** Origin of the request */
  origin?: string;
  /** Path being accessed */
  path?: string;
  /** User ID (if user session) */
  userId?: string;
  /** Agent token (if agent request) */
  agentToken?: string;
}

export interface PolicyCheckResponse {
  allowed: boolean;
  needsConfirm: boolean;
  subjectType: "user" | "agent";
  subjectId: string;
  policy: SpendPolicy;
  currentDailySpend: number;
  error?: ApiError;
}

/**
 * Check if a payment is allowed based on the subject's policy.
 * This is the main policy enforcement entry point.
 */
export const checkPaymentPolicy = (
  request: PolicyCheckRequest
): Effect.Effect<PolicyCheckResponse, ApiError, PolicyStore | AgentStore | UsageStore> =>
  Effect.gen(function* () {
    const policyStore = yield* PolicyStore;
    const agentStore = yield* AgentStore;
    const usageStore = yield* UsageStore;
    
    let policy: SpendPolicy;
    let subjectType: "user" | "agent";
    let subjectId: string;
    
    // Determine subject and load policy
    if (request.agentToken) {
      const agent = yield* agentStore.getAgentByToken(request.agentToken);
      policy = agent.policy;
      subjectType = "agent";
      subjectId = agent.agentId;
      // Update last used
      yield* agentStore.updateLastUsed(agent.agentId);
    } else if (request.userId) {
      policy = yield* policyStore.getUserPolicy(request.userId);
      subjectType = "user";
      subjectId = request.userId;
    } else {
      // No subject - use default policy
      policy = DEFAULT_SPEND_POLICY;
      subjectType = "user";
      subjectId = "anonymous";
    }
    
    // Get current daily spend
    const dayKey = getTodayKey();
    const subjectKey = makeSubjectId(subjectType, subjectId);
    const currentDailySpend = yield* usageStore.getDailySpendCents(subjectKey, dayKey);
    
    // Check policy
    const input: PolicyCheckInput = {
      amountCents: request.amountCents,
      origin: request.origin,
      path: request.path,
      currentDailySpendCents: currentDailySpend,
      subjectType,
      subjectId,
    };
    
    const result = checkPolicy(policy, input);
    
    if (result.allowed) {
      return {
        allowed: true,
        needsConfirm: result.needsConfirm,
        subjectType,
        subjectId,
        policy,
        currentDailySpend,
      };
    } else {
      return {
        allowed: false,
        needsConfirm: false,
        subjectType,
        subjectId,
        policy,
        currentDailySpend,
        error: result.error,
      };
    }
  });

/**
 * Record spend after a successful payment.
 */
export const recordSpend = (input: {
  subjectType: "user" | "agent";
  subjectId: string;
  amountCents: number;
}): Effect.Effect<void, ApiError, UsageStore> =>
  Effect.gen(function* () {
    const usageStore = yield* UsageStore;
    const dayKey = getTodayKey();
    const subjectKey = makeSubjectId(input.subjectType, input.subjectId);
    yield* usageStore.addSpendCents(subjectKey, dayKey, input.amountCents);
  });

/**
 * Get current daily spend for a subject.
 */
export const getDailySpend = (input: {
  subjectType: "user" | "agent";
  subjectId: string;
}): Effect.Effect<number, ApiError, UsageStore> =>
  Effect.gen(function* () {
    const usageStore = yield* UsageStore;
    const dayKey = getTodayKey();
    const subjectKey = makeSubjectId(input.subjectType, input.subjectId);
    return yield* usageStore.getDailySpendCents(subjectKey, dayKey);
  });
