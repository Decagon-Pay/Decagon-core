/**
 * SQLite Persistence Layer
 * 
 * Provides persistent storage for:
 * - Receipts
 * - Sessions (credits)
 * - Policies
 * - Agents
 * - Usage (daily spend tracking)
 * 
 * Challenges remain in-memory (short-lived).
 */

import Database from "better-sqlite3";
import { Layer, Effect } from "effect";
import {
  ReceiptsStore,
  PolicyStore,
  AgentStore,
  UsageStore,
} from "@decagon/core";
import type {
  Receipt,
  SessionToken,
  SpendPolicy,
  Agent,
  ApiError,
} from "@decagon/x402";
import { DEFAULT_SPEND_POLICY } from "@decagon/x402";
import path from "path";
import fs from "fs";

// ============================================
// Database Initialization
// ============================================

const getDbPath = (): string => {
  // Production: use DB_PATH env var, fallback to .data folder
  const dbPath = process.env["DB_PATH"] ?? path.join(process.cwd(), ".data", "decagon.db");
  
  // Ensure the directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  return dbPath;
};

let dbInstance: Database.Database | null = null;

export const getDb = (): Database.Database => {
  if (!dbInstance) {
    const dbPath = getDbPath();
    console.log(`[SQLite] Opening database at: ${dbPath}`);
    dbInstance = new Database(dbPath);
    dbInstance.pragma("journal_mode = WAL");
    initTables(dbInstance);
  }
  return dbInstance;
};

export const closeDb = (): void => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
};

const initTables = (db: Database.Database): void => {
  console.log("[SQLite] Initializing tables...");

  // Receipts table (matches Receipt type from x402)
  db.exec(`
    CREATE TABLE IF NOT EXISTS receipts (
      receipt_id TEXT PRIMARY KEY,
      challenge_id TEXT NOT NULL UNIQUE,
      resource_id TEXT NOT NULL,
      amount_paid INTEGER NOT NULL,
      currency TEXT NOT NULL,
      transaction_ref TEXT NOT NULL,
      verified_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      credits_purchased INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      tx_hash TEXT,
      explorer_url TEXT,
      block_number INTEGER,
      amount_native TEXT,
      payer_address TEXT,
      payee_address TEXT
    )
  `);

  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_id TEXT PRIMARY KEY,
      credits INTEGER NOT NULL,
      currency TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      access_count INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Policies table
  db.exec(`
    CREATE TABLE IF NOT EXISTS policies (
      user_id TEXT PRIMARY KEY,
      max_per_action_cents INTEGER NOT NULL,
      daily_cap_cents INTEGER NOT NULL,
      auto_approve_under_cents INTEGER NOT NULL,
      require_confirm_above_cents INTEGER NOT NULL,
      allowed_origins TEXT NOT NULL,
      allowed_paths TEXT NOT NULL
    )
  `);

  // Agents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      agent_id TEXT PRIMARY KEY,
      agent_token TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      max_per_action_cents INTEGER NOT NULL,
      daily_cap_cents INTEGER NOT NULL,
      auto_approve_under_cents INTEGER NOT NULL,
      require_confirm_above_cents INTEGER NOT NULL,
      allowed_origins TEXT NOT NULL,
      allowed_paths TEXT NOT NULL
    )
  `);

  // Usage table (daily spend tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL,
      day_key TEXT NOT NULL,
      spend_cents INTEGER NOT NULL DEFAULT 0,
      UNIQUE(subject_id, day_key)
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_receipts_challenge ON receipts(challenge_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_tx_hash ON receipts(tx_hash) WHERE tx_hash IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_receipts_tx_ref ON receipts(transaction_ref);
    CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id);
    CREATE INDEX IF NOT EXISTS idx_agents_token ON agents(agent_token);
    CREATE INDEX IF NOT EXISTS idx_usage_subject_day ON usage(subject_id, day_key);
  `);

  console.log("[SQLite] Tables initialized successfully");
};

// ============================================
// Helper Functions
// ============================================

const notFoundError = (resourceType: string, resourceId: string): ApiError => ({
  _tag: "NotFoundError",
  message: `${resourceType} not found: ${resourceId}`,
  timestamp: new Date().toISOString(),
  resourceType,
  resourceId,
});

const internalError = (message: string): ApiError => ({
  _tag: "InternalError",
  message,
  timestamp: new Date().toISOString(),
});

// Type for DB rows
interface DbRow {
  [key: string]: unknown;
}

// ============================================
// Live Receipts Store
// ============================================

export const LiveReceiptsStore = Layer.succeed(
  ReceiptsStore,
  ReceiptsStore.of({
    saveReceipt: (receipt: Receipt) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO receipts 
            (receipt_id, challenge_id, resource_id, amount_paid, currency, transaction_ref, verified_at, expires_at, credits_purchased, status, tx_hash, explorer_url, block_number, amount_native, payer_address, payee_address)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            receipt.receiptId,
            receipt.challengeId,
            receipt.resourceId,
            receipt.amountPaid,
            receipt.currency,
            receipt.transactionRef,
            receipt.verifiedAt,
            receipt.expiresAt,
            receipt.creditsPurchased,
            receipt.status,
            receipt.txHash ?? null,
            receipt.explorerUrl ?? null,
            receipt.blockNumber ?? null,
            receipt.amountNative ?? null,
            receipt.payerAddress ?? null,
            receipt.payeeAddress ?? null
          );
          return receipt;
        },
        catch: (e) => internalError(`Failed to save receipt: ${e}`),
      }),

    getReceipt: (receiptId: string) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const stmt = db.prepare("SELECT * FROM receipts WHERE receipt_id = ?");
          const row = stmt.get(receiptId) as DbRow | undefined;
          if (!row) {
            throw notFoundError("Receipt", receiptId);
          }
          return rowToReceipt(row);
        },
        catch: (e) => {
          if (typeof e === "object" && e && "_tag" in e) return e as ApiError;
          return internalError(`Failed to get receipt: ${e}`);
        },
      }),

    saveSession: (session: SessionToken) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO sessions 
            (token_id, credits, currency, created_at, expires_at, access_count)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            session.tokenId,
            session.credits,
            session.currency,
            session.createdAt,
            session.expiresAt,
            session.accessCount
          );
          return session;
        },
        catch: (e) => internalError(`Failed to save session: ${e}`),
      }),

    getSession: (tokenId: string) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const stmt = db.prepare("SELECT * FROM sessions WHERE token_id = ?");
          const row = stmt.get(tokenId) as DbRow | undefined;
          if (!row) {
            throw notFoundError("Session", tokenId);
          }
          return rowToSession(row);
        },
        catch: (e) => {
          if (typeof e === "object" && e && "_tag" in e) return e as ApiError;
          return internalError(`Failed to get session: ${e}`);
        },
      }),

    consumeCredits: (tokenId: string, amount: number) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const updateStmt = db.prepare(`
            UPDATE sessions 
            SET credits = credits - ?, access_count = access_count + 1 
            WHERE token_id = ? AND credits >= ?
          `);
          const result = updateStmt.run(amount, tokenId, amount);
          if (result.changes === 0) {
            // Check if session exists
            const checkStmt = db.prepare("SELECT credits FROM sessions WHERE token_id = ?");
            const row = checkStmt.get(tokenId) as { credits: number } | undefined;
            if (!row) {
              throw notFoundError("Session", tokenId);
            }
            throw {
              _tag: "InsufficientCreditsError",
              message: `Insufficient credits. Have: ${row.credits}, need: ${amount}`,
              timestamp: new Date().toISOString(),
              required: amount,
              available: row.credits,
            } as ApiError;
          }
          // Return updated session
          const stmt = db.prepare("SELECT * FROM sessions WHERE token_id = ?");
          const row = stmt.get(tokenId) as DbRow;
          return rowToSession(row);
        },
        catch: (e) => {
          if (typeof e === "object" && e && "_tag" in e) return e as ApiError;
          return internalError(`Failed to consume credits: ${e}`);
        },
      }),

    addCredits: (tokenId: string, amount: number) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const updateStmt = db.prepare(`
            UPDATE sessions SET credits = credits + ? WHERE token_id = ?
          `);
          const result = updateStmt.run(amount, tokenId);
          if (result.changes === 0) {
            throw notFoundError("Session", tokenId);
          }
          const stmt = db.prepare("SELECT * FROM sessions WHERE token_id = ?");
          const row = stmt.get(tokenId) as DbRow;
          return rowToSession(row);
        },
        catch: (e) => {
          if (typeof e === "object" && e && "_tag" in e) return e as ApiError;
          return internalError(`Failed to add credits: ${e}`);
        },
      }),

    hasReceiptForChallenge: (challengeId: string) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const stmt = db.prepare("SELECT 1 FROM receipts WHERE challenge_id = ? LIMIT 1");
          const row = stmt.get(challengeId);
          return row !== undefined;
        },
        catch: (e) => internalError(`Failed to check receipt: ${e}`),
      }),

    getReceiptByChallenge: (challengeId: string) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const stmt = db.prepare("SELECT * FROM receipts WHERE challenge_id = ? LIMIT 1");
          const row = stmt.get(challengeId) as DbRow | undefined;
          return row ? rowToReceipt(row) : null;
        },
        catch: (e) => internalError(`Failed to look up receipt by challenge: ${e}`),
      }),

    getReceiptByTxRef: (txRef: string) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const stmt = db.prepare(
            "SELECT * FROM receipts WHERE transaction_ref = ? OR tx_hash = ? LIMIT 1"
          );
          const row = stmt.get(txRef, txRef) as DbRow | undefined;
          return row ? rowToReceipt(row) : null;
        },
        catch: (e) => internalError(`Failed to look up receipt by txRef: ${e}`),
      }),
  })
);

// ============================================
// Live Policy Store
// ============================================

export const LivePolicyStore = Layer.succeed(
  PolicyStore,
  PolicyStore.of({
    getUserPolicy: (userId: string) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const stmt = db.prepare("SELECT * FROM policies WHERE user_id = ?");
          const row = stmt.get(userId) as DbRow | undefined;
          if (!row) {
            return DEFAULT_SPEND_POLICY;
          }
          return rowToPolicy(row);
        },
        catch: (e) => internalError(`Failed to get policy: ${e}`),
      }),

    setUserPolicy: (userId: string, policy: SpendPolicy) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO policies 
            (user_id, max_per_action_cents, daily_cap_cents, auto_approve_under_cents, require_confirm_above_cents, allowed_origins, allowed_paths)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            userId,
            policy.maxPerActionCents,
            policy.dailyCapCents,
            policy.autoApproveUnderCents,
            policy.requireConfirmAboveCents,
            JSON.stringify(policy.allowedOrigins),
            JSON.stringify(policy.allowedPaths)
          );
          return policy;
        },
        catch: (e) => internalError(`Failed to set policy: ${e}`),
      }),

    hasUserPolicy: (userId: string) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const stmt = db.prepare("SELECT 1 FROM policies WHERE user_id = ? LIMIT 1");
          const row = stmt.get(userId);
          return row !== undefined;
        },
        catch: (e) => internalError(`Failed to check policy: ${e}`),
      }),
  })
);

// ============================================
// Live Agent Store
// ============================================

export const LiveAgentStore = Layer.succeed(
  AgentStore,
  AgentStore.of({
    createAgent: (userId: string, name: string, policy: SpendPolicy) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const agentId = `agent_${crypto.randomUUID()}`;
          const agentToken = `agt_${crypto.randomUUID().replace(/-/g, "")}`;
          const now = new Date().toISOString();

          const stmt = db.prepare(`
            INSERT INTO agents 
            (agent_id, agent_token, user_id, name, created_at, max_per_action_cents, daily_cap_cents, auto_approve_under_cents, require_confirm_above_cents, allowed_origins, allowed_paths)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            agentId,
            agentToken,
            userId,
            name,
            now,
            policy.maxPerActionCents,
            policy.dailyCapCents,
            policy.autoApproveUnderCents,
            policy.requireConfirmAboveCents,
            JSON.stringify(policy.allowedOrigins),
            JSON.stringify(policy.allowedPaths)
          );

          return {
            agentId,
            agentToken,
            userId,
            name,
            policy,
            createdAt: now,
          } as Agent;
        },
        catch: (e) => internalError(`Failed to create agent: ${e}`),
      }),

    getAgentByToken: (agentToken: string) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const stmt = db.prepare("SELECT * FROM agents WHERE agent_token = ?");
          const row = stmt.get(agentToken) as DbRow | undefined;
          if (!row) {
            throw notFoundError("Agent", agentToken);
          }
          return rowToAgent(row);
        },
        catch: (e) => {
          if (typeof e === "object" && e && "_tag" in e) return e as ApiError;
          return internalError(`Failed to get agent: ${e}`);
        },
      }),

    getAgentById: (agentId: string) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const stmt = db.prepare("SELECT * FROM agents WHERE agent_id = ?");
          const row = stmt.get(agentId) as DbRow | undefined;
          if (!row) {
            throw notFoundError("Agent", agentId);
          }
          return rowToAgent(row);
        },
        catch: (e) => {
          if (typeof e === "object" && e && "_tag" in e) return e as ApiError;
          return internalError(`Failed to get agent: ${e}`);
        },
      }),

    listAgentsByUser: (userId: string) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const stmt = db.prepare("SELECT * FROM agents WHERE user_id = ? ORDER BY created_at DESC");
          const rows = stmt.all(userId) as DbRow[];
          return rows.map(rowToAgent);
        },
        catch: (e) => internalError(`Failed to list agents: ${e}`),
      }),

    updateLastUsed: (agentId: string) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const now = new Date().toISOString();
          const updateStmt = db.prepare("UPDATE agents SET last_used_at = ? WHERE agent_id = ?");
          const result = updateStmt.run(now, agentId);
          if (result.changes === 0) {
            throw notFoundError("Agent", agentId);
          }
          const stmt = db.prepare("SELECT * FROM agents WHERE agent_id = ?");
          const row = stmt.get(agentId) as DbRow;
          return rowToAgent(row);
        },
        catch: (e) => {
          if (typeof e === "object" && e && "_tag" in e) return e as ApiError;
          return internalError(`Failed to update agent: ${e}`);
        },
      }),

    deleteAgent: (agentId: string) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const stmt = db.prepare("DELETE FROM agents WHERE agent_id = ?");
          const result = stmt.run(agentId);
          if (result.changes === 0) {
            throw notFoundError("Agent", agentId);
          }
        },
        catch: (e) => {
          if (typeof e === "object" && e && "_tag" in e) return e as ApiError;
          return internalError(`Failed to delete agent: ${e}`);
        },
      }),
  })
);

// ============================================
// Live Usage Store
// ============================================

export const LiveUsageStore = Layer.succeed(
  UsageStore,
  UsageStore.of({
    getDailySpendCents: (subjectId: string, dayKey: string) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const stmt = db.prepare("SELECT spend_cents FROM usage WHERE subject_id = ? AND day_key = ?");
          const row = stmt.get(subjectId, dayKey) as { spend_cents: number } | undefined;
          return row?.spend_cents ?? 0;
        },
        catch: (e) => internalError(`Failed to get daily spend: ${e}`),
      }),

    addSpendCents: (subjectId: string, dayKey: string, amountCents: number) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const stmt = db.prepare(`
            INSERT INTO usage (id, subject_id, day_key, spend_cents)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(subject_id, day_key) 
            DO UPDATE SET spend_cents = spend_cents + ?
          `);
          stmt.run(`${subjectId}:${dayKey}`, subjectId, dayKey, amountCents, amountCents);
        },
        catch: (e) => internalError(`Failed to add spend: ${e}`),
      }),

    resetDailySpend: (subjectId: string, dayKey: string) =>
      Effect.try({
        try: () => {
          const db = getDb();
          const stmt = db.prepare("DELETE FROM usage WHERE subject_id = ? AND day_key = ?");
          stmt.run(subjectId, dayKey);
        },
        catch: (e) => internalError(`Failed to reset spend: ${e}`),
      }),
  })
);

// ============================================
// Row Conversion Helpers
// ============================================

const rowToReceipt = (row: DbRow): Receipt => ({
  receiptId: row["receipt_id"] as string,
  challengeId: row["challenge_id"] as string,
  resourceId: row["resource_id"] as string,
  amountPaid: row["amount_paid"] as number,
  currency: row["currency"] as string,
  transactionRef: row["transaction_ref"] as string,
  verifiedAt: row["verified_at"] as string,
  expiresAt: row["expires_at"] as string,
  creditsPurchased: row["credits_purchased"] as number,
  status: row["status"] as "confirmed" | "pending",
  txHash: row["tx_hash"] as string | undefined,
  explorerUrl: row["explorer_url"] as string | undefined,
  blockNumber: row["block_number"] as number | undefined,
  amountNative: row["amount_native"] as string | undefined,
  payerAddress: row["payer_address"] as string | undefined,
  payeeAddress: row["payee_address"] as string | undefined,
});

const rowToSession = (row: DbRow): SessionToken => ({
  tokenId: row["token_id"] as string,
  credits: row["credits"] as number,
  currency: row["currency"] as string,
  createdAt: row["created_at"] as string,
  expiresAt: row["expires_at"] as string,
  accessCount: row["access_count"] as number,
});

const rowToPolicy = (row: DbRow): SpendPolicy => ({
  maxPerActionCents: row["max_per_action_cents"] as number,
  dailyCapCents: row["daily_cap_cents"] as number,
  autoApproveUnderCents: row["auto_approve_under_cents"] as number,
  requireConfirmAboveCents: row["require_confirm_above_cents"] as number,
  allowedOrigins: JSON.parse(row["allowed_origins"] as string),
  allowedPaths: JSON.parse(row["allowed_paths"] as string),
});

const rowToAgent = (row: DbRow): Agent => ({
  agentId: row["agent_id"] as string,
  agentToken: row["agent_token"] as string,
  userId: row["user_id"] as string,
  name: row["name"] as string,
  policy: {
    maxPerActionCents: row["max_per_action_cents"] as number,
    dailyCapCents: row["daily_cap_cents"] as number,
    autoApproveUnderCents: row["auto_approve_under_cents"] as number,
    requireConfirmAboveCents: row["require_confirm_above_cents"] as number,
    allowedOrigins: JSON.parse(row["allowed_origins"] as string),
    allowedPaths: JSON.parse(row["allowed_paths"] as string),
  },
  createdAt: row["created_at"] as string,
  lastUsedAt: row["last_used_at"] as string | undefined,
});
