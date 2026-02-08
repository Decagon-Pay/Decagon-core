"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  DecagonChallenge,
  DecagonReceipt,
  DecagonPolicyResult,
  DecagonPaymentConfig,
  PaymentStep,
} from "./types";

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export interface PaymentSheetProps {
  challenge: DecagonChallenge;
  config: DecagonPaymentConfig;
  purpose?: string;
  existingSessionTokenId?: string;
  onClose: () => void;
  onSuccess: (receipt: DecagonReceipt, sessionToken: unknown) => void;
}

export function PaymentSheet({
  challenge,
  config,
  purpose,
  existingSessionTokenId,
  onClose,
  onSuccess,
}: PaymentSheetProps) {
  const [step, setStep] = useState<PaymentStep>("email");
  const [email, setEmail] = useState("");
  const [emailStored, setEmailStored] = useState(false);
  const [policyResult, setPolicyResult] = useState<DecagonPolicyResult | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<DecagonReceipt | null>(null);
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const chainIdHex = `0x${config.plasmaChainId.toString(16)}`;

  useEffect(() => {
    setHasMetaMask(typeof window !== "undefined" && !!window.ethereum?.isMetaMask);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("decagon_email");
    if (stored) {
      setEmail(stored);
      setEmailStored(true);
      handlePolicyCheck(stored);
    }
  }, []);

  useEffect(() => {
    const expiresAt = new Date(challenge.expiresAt).getTime();
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) setError("Challenge expired. Please refresh and try again.");
    }, 1000);
    return () => clearInterval(interval);
  }, [challenge.expiresAt]);

  const handleEmailSubmit = async () => {
    if (!email.includes("@")) {
      setError("Please enter a valid email");
      return;
    }
    localStorage.setItem("decagon_email", email);
    setEmailStored(true);
    await handlePolicyCheck(email);
  };

  const handlePolicyCheck = async (_email: string) => {
    setStep("policy");
    setError(null);
    try {
      const res = await fetch(`${config.apiBase}/policy/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: challenge.amountRequired,
          path: purpose ? `/transfer` : `/article/${challenge.resourceId}`,
        }),
      });
      const data: DecagonPolicyResult = await res.json();
      setPolicyResult(data);
      if (data.allowed) {
        if (data.needsConfirm || challenge.amountRequired > (data.policy.autoApproveUnderCents ?? 0)) {
          setStep("confirm");
        } else {
          handlePayment();
        }
      } else {
        setStep("blocked");
        setError(data.error?.message ?? "Payment blocked by policy");
      }
    } catch {
      setStep("confirm");
    }
  };

  const connectWallet = useCallback(async (): Promise<string | null> => {
    if (!window.ethereum) {
      setError("MetaMask not detected. Please install MetaMask.");
      return null;
    }
    try {
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts || accounts.length === 0) {
        setError("No accounts found. Please unlock MetaMask.");
        return null;
      }
      const address = accounts[0]!;
      setWalletAddress(address);
      const chainId = (await window.ethereum.request({ method: "eth_chainId" })) as string;
      if (parseInt(chainId, 16) !== config.plasmaChainId) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chainIdHex }],
          });
        } catch (switchError: unknown) {
          if ((switchError as { code?: number })?.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: chainIdHex,
                chainName: "Plasma Testnet",
                nativeCurrency: { name: "XPL", symbol: "XPL", decimals: 18 },
                rpcUrls: ["https://testnet-rpc.plasma.to"],
                blockExplorerUrls: ["https://testnet.plasmascan.to"],
              }],
            });
          } else {
            throw switchError;
          }
        }
      }
      return address;
    } catch (err) {
      setError(`Wallet connection failed: ${(err as Error).message}`);
      return null;
    }
  }, [chainIdHex, config.plasmaChainId]);

  const sendTransaction = useCallback(async (fromAddress: string): Promise<string | null> => {
    if (!window.ethereum) return null;
    try {
      const hash = (await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{
          from: fromAddress,
          to: challenge.payeeAddress,
          value: `0x${BigInt(challenge.amountWei).toString(16)}`,
          gas: "0x5208",
        }],
      })) as string;
      return hash;
    } catch (err) {
      setError(`Transaction failed: ${(err as Error).message}`);
      return null;
    }
  }, [challenge.payeeAddress, challenge.amountWei]);

  const verifyTransaction = useCallback(async (hash: string): Promise<boolean> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (existingSessionTokenId) headers["Authorization"] = `Bearer ${existingSessionTokenId}`;
    try {
      const res = await fetch(`${config.apiBase}/pay/verify`, {
        method: "POST",
        headers,
        body: JSON.stringify({ challengeId: challenge.challengeId, txHash: hash }),
      });
      if (res.ok) {
        const data = await res.json();
        setReceipt(data.receipt);
        onSuccess(data.receipt, data.sessionToken);
        return true;
      }
      const errData = await res.json();
      setError(errData.message ?? "Verification failed");
      return false;
    } catch {
      setError("Verification failed. Please try again.");
      return false;
    }
  }, [challenge.challengeId, config.apiBase, existingSessionTokenId, onSuccess]);

  const handlePayment = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStep("connecting");
    setError(null);
    try {
      const address = await connectWallet();
      if (!address) { setStep("confirm"); return; }
      setStep("sending");
      const hash = await sendTransaction(address);
      if (!hash) { setStep("confirm"); return; }
      setTxHash(hash);
      setStep("confirming");
      const verified = await verifyTransaction(hash);
      if (verified) setStep("success");
      else setStep("confirm");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMockPayment = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStep("confirming");
    setError(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (existingSessionTokenId) headers["Authorization"] = `Bearer ${existingSessionTokenId}`;
      const res = await fetch(`${config.apiBase}/pay/verify`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          transactionRef: `mock_tx_${Date.now()}`,
          payerAddress: email || "0xMockPayer",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setReceipt(data.receipt);
        setStep("success");
        setTimeout(() => onSuccess(data.receipt, data.sessionToken), 1500);
      } else {
        const errData = await res.json();
        setError(errData.message ?? "Payment failed");
        setStep("confirm");
      }
    } catch {
      setError("Payment failed. Please try again.");
      setStep("confirm");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatXpl = (wei: string) => (Number(BigInt(wei)) / 1e18).toFixed(6);
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const displayPurpose = purpose ?? `Unlock: ${challenge.description}`;
  const explorerBase = challenge.explorerTxBase || config.explorerTxBase;

  return (
    <div className="dg-overlay" onClick={onClose}>
      <div className="dg-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="dg-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.5rem" }}>🔷</span>
            <span style={{ fontWeight: 600, fontSize: "1.125rem" }}>Decagon Payment</span>
          </div>
          <button className="dg-close" onClick={onClose}>×</button>
        </div>

        <div className="dg-timer">
          <span style={{ color: countdown < 60 ? "var(--error, #ef4444)" : "var(--text-secondary, #94a3b8)" }}>
            Expires in {formatCountdown(countdown)}
          </span>
        </div>

        {error && <div className="dg-error">{error}</div>}

        {step === "email" && (
          <div className="dg-step">
            <h3>Welcome to Decagon</h3>
            <p style={{ color: "var(--text-secondary, #94a3b8)", marginBottom: "1.5rem" }}>
              Enter your email to continue with the payment.
            </p>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="dg-input"
              autoFocus
            />
            <button className="btn btn-primary btn-full" onClick={handleEmailSubmit}>
              Continue →
            </button>
          </div>
        )}

        {step === "policy" && (
          <div className="dg-step">
            <div className="dg-spinner-wrap"><div className="dg-spinner" /></div>
            <p style={{ textAlign: "center", color: "var(--text-secondary, #94a3b8)" }}>
              Checking spend policy...
            </p>
          </div>
        )}

        {step === "blocked" && policyResult && (
          <div className="dg-step">
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <span style={{ fontSize: "3rem" }}>🚫</span>
              <h3 style={{ marginTop: "1rem", color: "var(--error, #ef4444)" }}>Payment Blocked</h3>
            </div>
            <div className="dg-block-reason">
              <p><strong>Reason:</strong> {policyResult.error?.reason?.replace(/_/g, " ") ?? "Policy violation"}</p>
              <p>{policyResult.error?.message}</p>
            </div>
            <div className="dg-policy-details">
              <p><strong>Your Policy:</strong></p>
              <ul>
                <li>Max per action: {formatPrice(policyResult.policy.maxPerActionCents)}</li>
                <li>Daily cap: {formatPrice(policyResult.policy.dailyCapCents)}</li>
                <li>Today&apos;s spend: {formatPrice(policyResult.currentDailySpend)}</li>
              </ul>
            </div>
            <button className="btn btn-secondary btn-full" onClick={onClose}>Close</button>
            <a href="/settings" className="dg-settings-link">Update spend policy →</a>
          </div>
        )}

        {step === "confirm" && (
          <div className="dg-step">
            <h3>{purpose ? "Confirm Transfer" : "Confirm Purchase"}</h3>
            <div className="dg-summary">
              {purpose && (
                <div className="dg-row">
                  <span>Purpose</span>
                  <span className="dg-value">{purpose}</span>
                </div>
              )}
              <div className="dg-row">
                <span>Credits</span>
                <span className="dg-value">{challenge.creditsOffered}</span>
              </div>
              <div className="dg-row">
                <span>Price (USD)</span>
                <span className="dg-value">{formatPrice(challenge.amountRequired)}</span>
              </div>
              <div className="dg-row">
                <span>Pay with</span>
                <span className="dg-value">{formatXpl(challenge.amountWei)} {challenge.assetSymbol}</span>
              </div>
              <div className="dg-row">
                <span>Chain</span>
                <span className="dg-value">{challenge.chain}</span>
              </div>
              <div className="dg-row">
                <span>Recipient</span>
                <span className="dg-value" style={{ fontSize: "0.75rem" }}>
                  {challenge.payeeAddress?.slice(0, 6)}...{challenge.payeeAddress?.slice(-4)}
                </span>
              </div>
              <div className="dg-divider" />
              <div className="dg-row">
                <span>Cost per unlock</span>
                <span className="dg-value">1 credit</span>
              </div>
            </div>

            {policyResult && (
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted, #64748b)", marginBottom: "1rem" }}>
                Spend Policy: max {formatPrice(policyResult.policy.maxPerActionCents)}/action,{" "}
                {formatPrice(policyResult.policy.dailyCapCents - policyResult.currentDailySpend)} remaining today
              </p>
            )}

            {(policyResult?.needsConfirm || challenge.amountRequired > 100) && (
              <label className="dg-checkbox">
                <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
                <span>I confirm this {purpose ? "transfer" : "purchase"}</span>
              </label>
            )}

            {hasMetaMask ? (
              <button
                className="btn btn-success btn-full"
                onClick={handlePayment}
                disabled={isSubmitting || (policyResult?.needsConfirm && !confirmChecked)}
              >
                {isSubmitting ? "Processing…" : `🦊 Pay with MetaMask (${formatXpl(challenge.amountWei)} XPL)`}
              </button>
            ) : (
              <button
                className="btn btn-success btn-full"
                onClick={handleMockPayment}
                disabled={isSubmitting || (policyResult?.needsConfirm && !confirmChecked)}
              >
                {isSubmitting ? "Processing…" : `Pay ${formatPrice(challenge.amountRequired)} (Demo Mode)`}
              </button>
            )}

            {hasMetaMask && (
              <button
                className="btn btn-secondary btn-full"
                onClick={handleMockPayment}
                disabled={isSubmitting || (policyResult?.needsConfirm && !confirmChecked)}
              >
                {isSubmitting ? "Processing…" : "Skip wallet (Demo Mode)"}
              </button>
            )}
            <button className="btn btn-ghost btn-full" onClick={onClose}>Cancel</button>
          </div>
        )}

        {step === "connecting" && (
          <div className="dg-step">
            <div className="dg-spinner-wrap"><div className="dg-spinner" /></div>
            <p style={{ textAlign: "center", color: "var(--text-secondary, #94a3b8)" }}>Connecting wallet...</p>
            <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted, #64748b)" }}>
              Please approve the connection in MetaMask
            </p>
          </div>
        )}

        {step === "sending" && (
          <div className="dg-step">
            <div className="dg-spinner-wrap"><div className="dg-spinner" /></div>
            <p style={{ textAlign: "center", color: "var(--text-secondary, #94a3b8)" }}>Sending transaction...</p>
            <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted, #64748b)" }}>
              Please confirm the transaction in MetaMask
            </p>
            {walletAddress && (
              <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted, #64748b)", marginTop: "0.5rem" }}>
                From: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </p>
            )}
          </div>
        )}

        {step === "confirming" && (
          <div className="dg-step">
            <div className="dg-spinner-wrap"><div className="dg-spinner" /></div>
            <p style={{ textAlign: "center", color: "var(--text-secondary, #94a3b8)" }}>Confirming on chain...</p>
            {txHash && (
              <a
                href={`${explorerBase}${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "block", textAlign: "center", fontSize: "0.75rem", color: "var(--primary, #3b82f6)", marginTop: "0.5rem" }}
              >
                View on Explorer →
              </a>
            )}
          </div>
        )}

        {step === "success" && (
          <div className="dg-step">
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: "4rem" }}>✓</span>
              <h3 style={{ marginTop: "1rem", color: "var(--success, #10b981)" }}>
                {purpose ? "Transfer Successful!" : "Payment Successful!"}
              </h3>
              <p style={{ color: "var(--text-secondary, #94a3b8)" }}>
                {purpose
                  ? "Your transfer has been confirmed on-chain."
                  : `You now have ${challenge.creditsOffered} credits.`}
              </p>
            </div>
            {(txHash || receipt?.txHash) && (
              <div className="dg-receipt">
                <div className="dg-row">
                  <span>Transaction</span>
                  <span className="dg-value" style={{ fontSize: "0.75rem" }}>
                    {(txHash || receipt?.txHash)?.slice(0, 10)}...{(txHash || receipt?.txHash)?.slice(-6)}
                  </span>
                </div>
                {receipt?.blockNumber && (
                  <div className="dg-row">
                    <span>Block</span>
                    <span className="dg-value">#{receipt.blockNumber}</span>
                  </div>
                )}
                {receipt?.amountNative && (
                  <div className="dg-row">
                    <span>Amount</span>
                    <span className="dg-value">{receipt.amountNative}</span>
                  </div>
                )}
                <a
                  href={receipt?.explorerUrl || `${explorerBase}${txHash || receipt?.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-full"
                  style={{ marginTop: "1rem" }}
                >
                  View on Explorer →
                </a>
              </div>
            )}
          </div>
        )}

        <div className="dg-footer">
          <span>Powered by Decagon</span>
          <a href="/settings">Settings</a>
        </div>
      </div>

      <style jsx>{`
        .dg-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.7);
          display: flex; align-items: flex-end; justify-content: center;
          z-index: 1000;
        }
        .dg-sheet {
          background: var(--card-bg, #1e293b);
          border-radius: 16px 16px 0 0;
          width: 100%; max-width: 420px; max-height: 90vh;
          overflow-y: auto;
          animation: dgSlideUp 0.3s ease-out;
        }
        @keyframes dgSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .dg-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 1rem 1.5rem; border-bottom: 1px solid var(--border, #334155);
        }
        .dg-close {
          background: none; border: none; font-size: 1.5rem; cursor: pointer;
          color: var(--text-secondary, #94a3b8); padding: 0.25rem 0.5rem;
        }
        .dg-close:hover { color: var(--text, #e2e8f0); }
        .dg-timer {
          padding: 0.5rem 1.5rem; background: var(--bg-secondary, #0f172a);
          font-size: 0.75rem; text-align: center;
        }
        .dg-error {
          padding: 0.75rem 1.5rem; background: rgba(239,68,68,0.1);
          color: var(--error, #ef4444); font-size: 0.875rem;
        }
        .dg-step { padding: 1.5rem; }
        .dg-step h3 { margin-bottom: 0.5rem; }
        .dg-input {
          width: 100%; padding: 0.75rem 1rem;
          border: 1px solid var(--border, #334155); border-radius: 8px;
          background: var(--bg-secondary, #0f172a); color: var(--text, #e2e8f0);
          font-size: 1rem; margin-bottom: 1rem;
        }
        .dg-input:focus { outline: none; border-color: var(--primary, #3b82f6); }
        .dg-spinner-wrap { display: flex; justify-content: center; padding: 2rem 0; }
        .dg-spinner {
          width: 40px; height: 40px;
          border: 3px solid var(--border, #334155); border-top-color: var(--primary, #3b82f6);
          border-radius: 50%; animation: dgSpin 1s linear infinite;
        }
        @keyframes dgSpin { to { transform: rotate(360deg); } }
        .dg-summary {
          background: var(--bg-secondary, #0f172a); border-radius: 8px;
          padding: 1rem; margin-bottom: 1rem;
        }
        .dg-row { display: flex; justify-content: space-between; padding: 0.5rem 0; }
        .dg-value { font-weight: 600; }
        .dg-divider { height: 1px; background: var(--border, #334155); margin: 0.5rem 0; }
        .dg-block-reason {
          background: rgba(239,68,68,0.1); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;
        }
        .dg-policy-details {
          background: var(--bg-secondary, #0f172a); padding: 1rem; border-radius: 8px;
          margin-bottom: 1.5rem; font-size: 0.875rem;
        }
        .dg-policy-details ul { margin: 0.5rem 0 0 1rem; padding: 0; }
        .dg-checkbox {
          display: flex; align-items: center; gap: 0.5rem;
          margin-bottom: 1rem; cursor: pointer;
        }
        .dg-checkbox input { width: 18px; height: 18px; }
        .dg-receipt {
          background: var(--bg-secondary, #0f172a); border-radius: 8px;
          padding: 1rem; margin-top: 1.5rem;
        }
        .dg-settings-link {
          display: block; text-align: center; color: var(--primary, #3b82f6);
          font-size: 0.875rem; margin-top: 1rem;
        }
        .dg-footer {
          display: flex; justify-content: space-between;
          padding: 1rem 1.5rem; border-top: 1px solid var(--border, #334155);
          font-size: 0.75rem; color: var(--text-muted, #64748b);
        }
        .dg-footer a { color: var(--primary, #3b82f6); }
        .btn-full { width: 100%; margin-bottom: 0.5rem; }
        .btn-ghost { background: transparent; color: var(--text-secondary, #94a3b8); }
        .btn-ghost:hover { background: var(--bg-secondary, #0f172a); color: var(--text, #e2e8f0); }
        @media (min-width: 640px) {
          .dg-overlay { align-items: center; }
          .dg-sheet { border-radius: 16px; max-height: 80vh; }
        }
      `}</style>
    </div>
  );
}
