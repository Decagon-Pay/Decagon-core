import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateShort(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function shortenAddress(addr: string): string {
  if (!addr) return "-";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function shortenHash(hash: string): string {
  if (!hash) return "-";
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}
