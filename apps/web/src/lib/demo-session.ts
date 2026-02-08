/**
 * Demo Session System
 *
 * Provides mock auth for the remittance fintech demo.
 * Generates a deterministic demo wallet address from the user's email.
 * Stores session in localStorage — purely cosmetic, no real auth.
 *
 * ⚠️  DEMO MODE — not a real authentication system.
 */

export interface DemoUser {
  email: string;
  displayName: string;
  avatarInitial: string;
  walletAddress: string;
  authMethod: "email" | "google";
  createdAt: string;
}

const DEMO_SESSION_KEY = "decagon_demo_session";

/* ---------- helpers ---------- */

/** Simple hash → hex string (deterministic, not cryptographic) */
function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  // Convert to positive hex, pad to 40 chars for a fake ETH address
  const hex = Math.abs(h).toString(16).padStart(8, "0");
  return hex.repeat(5).slice(0, 40);
}

function generateDemoWallet(email: string): string {
  return `0xDE${simpleHash(email).slice(0, 38)}`;
}

function deriveDisplayName(email: string): string {
  const local = email.split("@")[0];
  return local
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ---------- public API ---------- */

export function getDemoSession(): DemoUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DemoUser;
  } catch {
    localStorage.removeItem(DEMO_SESSION_KEY);
    return null;
  }
}

export function createDemoSession(
  email: string,
  method: "email" | "google"
): DemoUser {
  const user: DemoUser = {
    email,
    displayName: deriveDisplayName(email),
    avatarInitial: email.charAt(0).toUpperCase(),
    walletAddress: generateDemoWallet(email),
    authMethod: method,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
  return user;
}

export function clearDemoSession(): void {
  localStorage.removeItem(DEMO_SESSION_KEY);
}
