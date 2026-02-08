/**
 * Chain Configuration Capability
 * 
 * Provides blockchain configuration for payment operations.
 * Abstracted as an Effect capability for testability.
 */

import { Context, Effect } from "effect";

/**
 * Chain configuration for payment operations
 */
export interface ChainConfig {
  /** Chain ID (e.g., 9746 for Plasma Testnet) */
  readonly chainId: number;
  /** Chain name (e.g., "Plasma Testnet") */
  readonly chainName: string;
  /** RPC URL for chain interactions */
  readonly rpcUrl: string;
  /** Asset type: "NATIVE" for native token */
  readonly assetType: "NATIVE" | "ERC20";
  /** Asset symbol (e.g., "XPL") */
  readonly assetSymbol: string;
  /** Number of decimals for the asset */
  readonly assetDecimals: number;
  /** Address to receive payments */
  readonly payeeAddress: string;
  /** Base URL for transaction explorer */
  readonly explorerTxBase: string;
  /** Topup price in wei (as string to avoid precision issues) */
  readonly topupPriceWei: string;
  /** Topup price in display units (e.g., "0.0001") */
  readonly topupPriceDisplay: string;
}

/**
 * ChainConfig capability interface
 */
export interface ChainConfigService {
  readonly getConfig: () => Effect.Effect<ChainConfig, never>;
}

/**
 * ChainConfig Effect Tag
 */
export const ChainConfigService = Context.GenericTag<ChainConfigService>("@decagon/core/ChainConfig");
