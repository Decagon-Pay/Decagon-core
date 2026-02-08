/**
 * Demo Balance Ledger
 *
 * Tracks a fake USD balance and demo transfer history in localStorage.
 * Enforces the same spend-policy model used by the real Decagon pipeline.
 *
 * ⚠️  DEMO MODE: no real money moves.
 */

export interface DemoTransaction {
  id: string;
  type: "topup" | "send";
  amountCents: number;
  /** For sends: recipient contact id */
  recipientId?: string;
  recipientName?: string;
  note?: string;
  createdAt: string;
  /** Fake status for visual polish */
  status: "completed" | "pending";
}

interface DemoLedger {
  balanceCents: number;
  transactions: DemoTransaction[];
  /** Running daily spend total (cents). Resets each calendar day. */
  dailySpentCents: number;
  dailyResetDate: string; // ISO date string YYYY-MM-DD
}

const LEDGER_KEY = "decagon_demo_ledger";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function uid(): string {
  return `demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------- persistence ---------- */

function load(): DemoLedger {
  if (typeof window === "undefined") {
    return {
      balanceCents: 0,
      transactions: [],
      dailySpentCents: 0,
      dailyResetDate: todayStr(),
    };
  }
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    if (!raw) throw new Error("empty");
    const ledger = JSON.parse(raw) as DemoLedger;
    // Auto-reset daily spend counter if day rolled over
    if (ledger.dailyResetDate !== todayStr()) {
      ledger.dailySpentCents = 0;
      ledger.dailyResetDate = todayStr();
    }
    return ledger;
  } catch {
    const fresh: DemoLedger = {
      balanceCents: 0,
      transactions: [],
      dailySpentCents: 0,
      dailyResetDate: todayStr(),
    };
    localStorage.setItem(LEDGER_KEY, JSON.stringify(fresh));
    return fresh;
  }
}

function save(ledger: DemoLedger): void {
  localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
}

/* ---------- public API ---------- */

export function getBalance(): number {
  return load().balanceCents;
}

export function getTransactions(): DemoTransaction[] {
  return load().transactions;
}

export function getDailySpent(): number {
  return load().dailySpentCents;
}

/**
 * Add demo funds (fake card top-up).
 * Returns new balance in cents.
 */
export function topUp(amountCents: number): number {
  const ledger = load();
  ledger.balanceCents += amountCents;
  ledger.transactions.unshift({
    id: uid(),
    type: "topup",
    amountCents,
    createdAt: new Date().toISOString(),
    status: "completed",
  });
  save(ledger);
  return ledger.balanceCents;
}

export interface SpendPolicyCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Validate a transfer amount against spend policy limits.
 */
export function checkSpendPolicy(
  amountCents: number,
  policy: {
    maxPerActionCents: number;
    dailyCapCents: number;
  }
): SpendPolicyCheck {
  if (amountCents <= 0) return { ok: false, reason: "Amount must be positive" };
  const ledger = load();
  if (amountCents > ledger.balanceCents) {
    return { ok: false, reason: "Insufficient demo balance" };
  }
  if (amountCents > policy.maxPerActionCents) {
    return {
      ok: false,
      reason: `Exceeds per-transaction limit ($${(policy.maxPerActionCents / 100).toFixed(2)})`,
    };
  }
  if (ledger.dailySpentCents + amountCents > policy.dailyCapCents) {
    return {
      ok: false,
      reason: `Would exceed daily cap ($${(policy.dailyCapCents / 100).toFixed(2)})`,
    };
  }
  return { ok: true };
}

/**
 * Execute a demo transfer. Deducts from balance + records tx.
 * Returns the new DemoTransaction on success, or an error string.
 */
export function sendTransfer(opts: {
  amountCents: number;
  recipientId: string;
  recipientName: string;
  note?: string;
}): DemoTransaction | string {
  const ledger = load();
  if (opts.amountCents > ledger.balanceCents) {
    return "Insufficient demo balance";
  }

  const tx: DemoTransaction = {
    id: uid(),
    type: "send",
    amountCents: opts.amountCents,
    recipientId: opts.recipientId,
    recipientName: opts.recipientName,
    note: opts.note,
    createdAt: new Date().toISOString(),
    status: "completed",
  };

  ledger.balanceCents -= opts.amountCents;
  ledger.dailySpentCents += opts.amountCents;
  ledger.transactions.unshift(tx);
  save(ledger);
  return tx;
}

/**
 * Completely reset the demo ledger (for sign-out).
 */
export function resetLedger(): void {
  localStorage.removeItem(LEDGER_KEY);
}
