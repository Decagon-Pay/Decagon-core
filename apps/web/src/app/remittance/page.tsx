"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PaymentSheet, useDecagonPayment } from "@decagon/ui";
import type { DecagonChallenge, DecagonReceipt } from "@decagon/ui";
import { API_BASE, PLASMA_CHAIN_ID, PLASMA_EXPLORER_TX_BASE } from "@/lib/config";

interface TransferRecord {
  receiptId: string;
  resourceId: string;
  amountPaid: number;
  currency: string;
  transactionRef: string;
  verifiedAt: string;
  txHash?: string;
  explorerUrl?: string;
  payerAddress?: string;
  payeeAddress?: string;
}

const SESSION_KEY = "decagon_session_token";

function getStoredSessionTokenId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      const session = JSON.parse(stored);
      if (new Date(session.expiresAt) > new Date()) return session.tokenId;
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    localStorage.removeItem(SESSION_KEY);
  }
  return undefined;
}

export default function RemittancePage() {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<DecagonChallenge | null>(null);
  const [history, setHistory] = useState<TransferRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const payment = useDecagonPayment();

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/transfer/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.transfers ?? []);
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleCreateTransfer = async () => {
    if (!recipientAddress) {
      setMessage({ type: "error", text: "Please enter a recipient address" });
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      setMessage({ type: "error", text: "Invalid Ethereum address" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE}/transfer/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientAddress,
          note: note || undefined,
        }),
      });

      const data = await res.json();

      if (data.challenge) {
        setChallenge(data.challenge);
        payment.open({
          challenge: data.challenge,
          config: {
            apiBase: API_BASE,
            plasmaChainId: PLASMA_CHAIN_ID,
            explorerTxBase: PLASMA_EXPLORER_TX_BASE,
          },
          purpose: note || "Remittance transfer",
          existingSessionTokenId: getStoredSessionTokenId(),
          onSuccess: handleTransferSuccess,
          onClose: () => setChallenge(null),
        });
      } else {
        setMessage({ type: "error", text: data.message ?? "Failed to create transfer" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Is the API running?" });
    } finally {
      setLoading(false);
    }
  };

  const handleTransferSuccess = (_receipt: DecagonReceipt, sessionToken: unknown) => {
    setChallenge(null);
    setMessage({ type: "success", text: "Transfer sent successfully!" });
    setRecipientAddress("");
    setNote("");
    if (sessionToken && typeof sessionToken === "object" && "tokenId" in sessionToken) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionToken));
    }
    fetchHistory();
  };

  const shortenAddress = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "—";

  return (
    <main className="container" style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <Link href="/" className="back-link">← Back to Marketplace</Link>

      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          💸 Remittance
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Send funds to any address on Plasma testnet using the same Decagon Payment Sheet.
        </p>
      </div>

      {message && (
        <div style={{
          padding: "0.75rem 1rem",
          borderRadius: 8,
          marginBottom: "1rem",
          background: message.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
          color: message.type === "success" ? "var(--success)" : "var(--error)",
        }}>
          {message.text}
        </div>
      )}

      <div style={{
        background: "var(--card-bg)",
        borderRadius: 12,
        border: "1px solid var(--border)",
        padding: "1.5rem",
        marginBottom: "2rem",
      }}>
        <h3 style={{ marginBottom: "1rem" }}>New Transfer</h3>

        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          Recipient Address
        </label>
        <input
          type="text"
          placeholder="0x..."
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          style={{
            width: "100%",
            padding: "0.75rem 1rem",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--bg-secondary)",
            color: "var(--text)",
            fontSize: "0.9rem",
            fontFamily: "monospace",
            marginBottom: "1rem",
          }}
        />

        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          Note (optional)
        </label>
        <input
          type="text"
          placeholder="e.g. Rent payment, Gift, Invoice #123"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{
            width: "100%",
            padding: "0.75rem 1rem",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--bg-secondary)",
            color: "var(--text)",
            fontSize: "0.9rem",
            marginBottom: "1.5rem",
          }}
        />

        <button
          className="btn btn-primary"
          onClick={handleCreateTransfer}
          disabled={loading}
          style={{ width: "100%" }}
        >
          {loading ? "Creating transfer..." : "Send Transfer →"}
        </button>
      </div>

      <div>
        <h3 style={{ marginBottom: "1rem" }}>Transfer History</h3>
        {historyLoading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : history.length === 0 ? (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "2rem" }}>
            No transfers yet. Send your first transfer above.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {history.map((tx) => (
              <div
                key={tx.receiptId}
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "1rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontWeight: 600 }}>
                    To: {shortenAddress(tx.resourceId?.replace("transfer:", "") ?? "")}
                  </span>
                  <span style={{ color: "var(--success)", fontWeight: 600 }}>
                    ${((tx.amountPaid ?? 0) / 100).toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                  <span>{tx.verifiedAt ? new Date(tx.verifiedAt).toLocaleString() : "—"}</span>
                  {tx.txHash && (
                    <a
                      href={tx.explorerUrl || `${PLASMA_EXPLORER_TX_BASE}${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--primary)" }}
                    >
                      View TX →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {payment.isOpen && payment.challenge && payment.config && (
        <PaymentSheet
          challenge={payment.challenge}
          config={payment.config}
          purpose={payment.purpose}
          existingSessionTokenId={payment.existingSessionTokenId}
          onClose={payment.close}
          onSuccess={payment.onSuccess}
        />
      )}
    </main>
  );
}
