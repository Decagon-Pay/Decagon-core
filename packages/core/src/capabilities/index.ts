/**
 * Capabilities Index
 * 
 * Re-exports all effect capability interfaces.
 * These interfaces define the I/O boundaries for the effectful core.
 */

export { ArticlesStore, type ArticlesStoreService } from "./articles-store.js";
export { ReceiptsStore, type ReceiptsStoreService } from "./receipts-store.js";
export { ChallengesStore, type ChallengesStoreService } from "./challenges-store.js";
export { PolicyStore, type PolicyStoreService } from "./policy-store.js";
export { AgentStore, type AgentStoreService } from "./agent-store.js";
export { UsageStore, type UsageStoreService } from "./usage-store.js";
export { Clock, type ClockService } from "./clock.js";
export { IdGen, type IdGenService } from "./id-gen.js";
export { Logger, type LoggerService, type LogLevel, type LogContext } from "./logger.js";
export { 
  PaymentVerifier, 
  type PaymentVerifierService,
  type PaymentProof,
  type VerificationResult 
} from "./payment-verifier.js";

export { ChainConfigService, type ChainConfig } from "./chain-config.js";
export { 
  PlasmaRpc, 
  type RpcTransaction, 
  type RpcTransactionReceipt, 
  type RpcBlock, 
  type RpcLog,
  type RpcError,
  rpcError,
  hexToNumber,
  hexToBigInt,
  numberToHex
} from "./plasma-rpc.js";
