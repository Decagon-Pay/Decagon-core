/**
 * API Configuration
 * 
 * Uses NEXT_PUBLIC_API_BASE_URL environment variable in production,
 * falls back to localhost for development.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// Plasma chain configuration
export const PLASMA_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_PLASMA_CHAIN_ID ?? "9746", 10);
export const PLASMA_EXPLORER_TX_BASE = process.env.NEXT_PUBLIC_PLASMA_EXPLORER_TX_BASE ?? "https://testnet.plasmascan.to/tx/";
