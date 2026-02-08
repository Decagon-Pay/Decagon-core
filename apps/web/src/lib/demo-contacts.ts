/**
 * Demo Contacts
 *
 * Hardcoded fake users for the remittance demo's "send to contact" flow.
 * Each contact has a display name, fake wallet, and country flag.
 *
 * ⚠️  DEMO MODE — these are not real people or wallets.
 */

export interface DemoContact {
  id: string;
  name: string;
  email: string;
  avatarInitial: string;
  walletAddress: string;
  /** Emoji flag */
  country: string;
  /** Color for the avatar circle (Tailwind bg class) */
  color: string;
}

export const DEMO_CONTACTS: DemoContact[] = [
  {
    id: "c1",
    name: "Sofia Martinez",
    email: "sofia@example.com",
    avatarInitial: "S",
    walletAddress: "0xDE1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a",
    country: "🇲🇽",
    color: "bg-violet-500",
  },
  {
    id: "c2",
    name: "James Nguyen",
    email: "james.n@example.com",
    avatarInitial: "J",
    walletAddress: "0xDE2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
    country: "🇻🇳",
    color: "bg-blue-500",
  },
  {
    id: "c3",
    name: "Amara Okafor",
    email: "amara@example.com",
    avatarInitial: "A",
    walletAddress: "0xDE3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c",
    country: "🇳🇬",
    color: "bg-emerald-500",
  },
  {
    id: "c4",
    name: "Ravi Sharma",
    email: "ravi.s@example.com",
    avatarInitial: "R",
    walletAddress: "0xDE4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d",
    country: "🇮🇳",
    color: "bg-amber-500",
  },
  {
    id: "c5",
    name: "Lena Becker",
    email: "lena.b@example.com",
    avatarInitial: "L",
    walletAddress: "0xDE5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e",
    country: "🇩🇪",
    color: "bg-rose-500",
  },
  {
    id: "c6",
    name: "Carlos Rivera",
    email: "carlos@example.com",
    avatarInitial: "C",
    walletAddress: "0xDE6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f",
    country: "🇵🇭",
    color: "bg-cyan-500",
  },
];
