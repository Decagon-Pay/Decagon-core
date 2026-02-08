"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PaymentSheet, useDecagonPayment } from "@decagon/ui";
import type { DecagonChallenge, DecagonReceipt } from "@decagon/ui";
import {
  API_BASE,
  PLASMA_CHAIN_ID,
  PLASMA_EXPLORER_TX_BASE,
} from "@/lib/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Send,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Clock,
  Wallet,
} from "lucide-react";

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

function shortenAddress(addr: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
}

export default function RemittancePage() {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<DecagonChallenge | null>(null);
  const [history, setHistory] = useState<TransferRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
        setMessage({
          type: "error",
          text: data.message ?? "Failed to create transfer",
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: "Network error. Is the API running?",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTransferSuccess = (
    _receipt: DecagonReceipt,
    sessionToken: unknown
  ) => {
    setChallenge(null);
    setMessage({ type: "success", text: "Transfer sent successfully!" });
    setRecipientAddress("");
    setNote("");
    if (
      sessionToken &&
      typeof sessionToken === "object" &&
      "tokenId" in sessionToken
    ) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionToken));
    }
    fetchHistory();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Send className="h-5 w-5 text-primary" />
          <Badge variant="muted">Remittance Demo</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Remittance</h1>
        <p className="mt-2 text-muted-foreground">
          Send funds to any address on Plasma testnet using the Decagon Payment
          Sheet.
        </p>
      </div>

      {/* Status message */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 mb-6 text-sm ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-200"
              : "bg-red-500/10 text-red-600 border border-red-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Transfer form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">New Transfer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
              Recipient Address
            </label>
            <Input
              type="text"
              placeholder="0x..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
              Note (optional)
            </label>
            <Input
              type="text"
              placeholder="e.g. Rent payment, Gift, Invoice #123"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleCreateTransfer}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {loading ? "Creating transfer…" : "Send Transfer"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </CardContent>
      </Card>

      {/* Transfer history */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Transfer History</h2>

        {historyLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Wallet className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No transfers yet. Send your first transfer above.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {history.map((tx) => (
              <Card key={tx.receiptId}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm flex items-center gap-1.5">
                      <Send className="h-3.5 w-3.5 text-muted-foreground" />
                      To:{" "}
                      <span className="font-mono">
                        {shortenAddress(
                          tx.resourceId?.replace("transfer:", "") ?? ""
                        )}
                      </span>
                    </span>
                    <Badge variant="success" className="font-semibold">
                      ${((tx.amountPaid ?? 0) / 100).toFixed(2)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {tx.verifiedAt
                        ? new Date(tx.verifiedAt).toLocaleString()
                        : "—"}
                    </span>
                    {tx.txHash && (
                      <a
                        href={
                          tx.explorerUrl ||
                          `${PLASMA_EXPLORER_TX_BASE}${tx.txHash}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        View TX <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Payment Sheet */}
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
    </div>
  );
}
