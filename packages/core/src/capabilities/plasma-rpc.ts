/**
 * Plasma RPC Capability
 * 
 * Provides blockchain RPC operations for Plasma network.
 * Abstracted as an Effect capability for testability.
 */

import { Context, Effect } from "effect";

/**
 * Ethereum transaction structure from RPC
 */
export interface RpcTransaction {
  readonly hash: string;
  readonly from: string;
  readonly to: string | null;
  readonly value: string; // hex wei
  readonly blockNumber: string | null; // hex, null if pending
  readonly blockHash: string | null;
  readonly gas: string; // hex
  readonly gasPrice: string; // hex
  readonly input: string;
  readonly nonce: string; // hex
  readonly transactionIndex: string | null; // hex
}

/**
 * Ethereum transaction receipt from RPC
 */
export interface RpcTransactionReceipt {
  readonly transactionHash: string;
  readonly blockNumber: string; // hex
  readonly blockHash: string;
  readonly from: string;
  readonly to: string | null;
  readonly status: string; // "0x1" = success, "0x0" = failure
  readonly gasUsed: string; // hex
  readonly cumulativeGasUsed: string; // hex
  readonly logs: readonly RpcLog[];
  readonly contractAddress: string | null;
}

/**
 * Ethereum log entry from RPC
 */
export interface RpcLog {
  readonly address: string;
  readonly topics: readonly string[];
  readonly data: string;
  readonly blockNumber: string; // hex
  readonly transactionHash: string;
  readonly logIndex: string; // hex
}

/**
 * Block header from RPC
 */
export interface RpcBlock {
  readonly number: string; // hex
  readonly hash: string;
  readonly timestamp: string; // hex, unix timestamp
  readonly parentHash: string;
  readonly miner: string;
  readonly gasUsed: string; // hex
  readonly gasLimit: string; // hex
}

/**
 * PlasmaRpc capability interface
 */
export interface PlasmaRpc {
  /**
   * Get transaction by hash
   * Returns null if transaction not found
   */
  readonly getTransaction: (txHash: string) => Effect.Effect<RpcTransaction | null, RpcError>;
  
  /**
   * Get transaction receipt by hash
   * Returns null if transaction not confirmed yet
   */
  readonly getTransactionReceipt: (txHash: string) => Effect.Effect<RpcTransactionReceipt | null, RpcError>;
  
  /**
   * Get block by number
   */
  readonly getBlock: (blockNumber: string | "latest") => Effect.Effect<RpcBlock | null, RpcError>;
  
  /**
   * Get current block number
   */
  readonly getBlockNumber: () => Effect.Effect<string, RpcError>;
  
  /**
   * Get chain ID
   */
  readonly getChainId: () => Effect.Effect<string, RpcError>;
}

/**
 * RPC error type
 */
export interface RpcError {
  readonly _tag: "RpcError";
  readonly message: string;
  readonly code?: number;
  readonly data?: unknown;
}

export const rpcError = (message: string, code?: number, data?: unknown): RpcError => ({
  _tag: "RpcError",
  message,
  code,
  data,
});

/**
 * PlasmaRpc Effect Tag
 */
export const PlasmaRpc = Context.GenericTag<PlasmaRpc>("@decagon/core/PlasmaRpc");

/**
 * Helper to convert hex to number
 */
export const hexToNumber = (hex: string): number => parseInt(hex, 16);

/**
 * Helper to convert hex to bigint (for wei values)
 */
export const hexToBigInt = (hex: string): bigint => BigInt(hex);

/**
 * Helper to convert number to hex
 */
export const numberToHex = (num: number): string => `0x${num.toString(16)}`;
