"use client";

import { useState, useEffect, useCallback } from "react";
import { API_BASE, PLASMA_CHAIN_ID, PLASMA_EXPLORER_TX_BASE } from "@/lib/config";

// Chain configuration derived from config
const PLASMA_CHAIN_ID_HEX = `0x${PLASMA_CHAIN_ID.toString(16)}`;

interface PaymentChallenge {
  challengeId: string;
  resourceId: string;
  amountRequired: number;
  currency: string;
  chain: string;
  description: string;
  payTo: string;
  expiresAt: string;
  createdAt: string;
  creditsOffered: number;
  status: string;
  // Step 4: On-chain payment fields
  chainId: number;
  assetType: "NATIVE" | "ERC20";
  assetSymbol: string;
  amountWei: string;
  payeeAddress: string;
  explorerTxBase: string;
}

interface SpendPolicy {
  maxPerActionCents: number;
  dailyCapCents: number;
  autoApproveUnderCents: number;
  requireConfirmAboveCents: number;
  allowedOrigins: string[];
  allowedPaths: string[];
}

interface PolicyCheckResult {
  allowed: boolean;
  needsConfirm?: boolean;
  subjectType: string;
  subjectId: string;
  policy: SpendPolicy;
  currentDailySpend: number;
  error?: {
    _tag: string;
    message: string;
    reason: string;
  };
}

interface Receipt {
  receiptId: string;
  txHash?: string;
  explorerUrl?: string;
  blockNumber?: number;
  amountNative?: string;
}

interface PaymentSheetProps {
  challenge: PaymentChallenge;
  onClose: () => void;
  onSuccess: (receipt: Receipt, sessionToken: unknown) => void;
  existingSessionTokenId?: string;
}

type Step = "email" | "policy" | "confirm" | "connecting" | "sending" | "confirming" | "success" | "blocked";

// Declare ethereum provider type
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

export default function PaymentSheet({ challenge, onClose, onSuccess, existingSessionTokenId }: PaymentSheetProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [emailStored, setEmailStored] = useState(false);
  const [policyResult, setPolicyResult] = useState<PolicyCheckResult | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  
  // Wallet state
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [hasMetaMask, setHasMetaMask] = useState<boolean>(false);
  
  // Check for MetaMask on mount
  useEffect(() => {
    setHasMetaMask(typeof window !== "undefined" && !!window.ethereum?.isMetaMask);
  }, []);

  // Load stored email
  useEffect(() => {
    const stored = localStorage.getItem("decagon_email");
    if (stored) {
      setEmail(stored);
      setEmailStored(true);
      // Skip to policy check if already have email
      handlePolicyCheck(stored);
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    const expiresAt = new Date(challenge.expiresAt).getTime();
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) {
        setError("Challenge expired. Please refresh and try again.");
      }
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
      const res = await fetch(`${API_BASE}/policy/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: challenge.amountRequired,
          path: `/article/${challenge.resourceId}`,
        }),
      });

      const data: PolicyCheckResult = await res.json();
      setPolicyResult(data);
      
      if (data.allowed) {
        if (data.needsConfirm || challenge.amountRequired > (data.policy.autoApproveUnderCents ?? 0)) {
          setStep("confirm");
        } else {
          // Auto-approve - skip confirmation
          handlePayment();
        }
      } else {
        setStep("blocked");
        setError(data.error?.message ?? "Payment blocked by policy");
      }
    } catch (e) {
      console.error("Policy check failed:", e);
      // On error, proceed to confirmation (graceful degradation)
      setStep("confirm");
    }
  };

  const connectWallet = useCallback(async (): Promise<string | null> => {
    if (!window.ethereum) {
      setError("MetaMask not detected. Please install MetaMask.");
      return null;
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      }) as string[];

      if (!accounts || accounts.length === 0) {
        setError("No accounts found. Please unlock MetaMask.");
        return null;
      }

      const address = accounts[0];
      setWalletAddress(address);

      // Check and switch chain if needed
      const chainId = await window.ethereum.request({ method: "eth_chainId" }) as string;
      if (parseInt(chainId, 16) !== PLASMA_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: PLASMA_CHAIN_ID_HEX }],
          });
        } catch (switchError: unknown) {
          // Chain not added, try to add it
          if ((switchError as { code?: number })?.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: PLASMA_CHAIN_ID_HEX,
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
      console.error("Wallet connection failed:", err);
      setError(`Wallet connection failed: ${(err as Error).message}`);
      return null;
    }
  }, []);

  const sendTransaction = useCallback(async (fromAddress: string): Promise<string | null> => {
    if (!window.ethereum) return null;

    try {
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{
          from: fromAddress,
          to: challenge.payeeAddress,
          value: `0x${BigInt(challenge.amountWei).toString(16)}`,
          gas: "0x5208", // 21000 for simple transfer
        }],
      }) as string;

      return txHash;
    } catch (err) {
      console.error("Transaction failed:", err);
      setError(`Transaction failed: ${(err as Error).message}`);
      return null;
    }
  }, [challenge.payeeAddress, challenge.amountWei]);

  const verifyTransaction = useCallback(async (hash: string): Promise<boolean> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (existingSessionTokenId) {
      headers["Authorization"] = `Bearer ${existingSessionTokenId}`;
    }

    try {
      const res = await fetch(`${API_BASE}/pay/verify`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          txHash: hash,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setReceipt(data.receipt);
        onSuccess(data.receipt, data.sessionToken);
        return true;
      } else {
        const errData = await res.json();
        setError(errData.message ?? "Verification failed");
        return false;
      }
    } catch (err) {
      console.error("Verification failed:", err);
      setError("Verification failed. Please try again.");
      return false;
    }
  }, [challenge.challengeId, existingSessionTokenId, onSuccess]);

  const handlePayment = async () => {
    setStep("connecting");
    setError(null);

    // Step 1: Connect wallet
    const address = await connectWallet();
    if (!address) {
      setStep("confirm");
      return;
    }

    // Step 2: Send transaction
    setStep("sending");
    const hash = await sendTransaction(address);
    if (!hash) {
      setStep("confirm");
      return;
    }
    setTxHash(hash);

    // Step 3: Verify transaction
    setStep("confirming");
    const verified = await verifyTransaction(hash);
    if (verified) {
      setStep("success");
    } else {
      setStep("confirm");
    }
  };

  // Legacy mock payment for testing without wallet
  const handleMockPayment = async () => {
    setStep("confirming");
    setError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (existingSessionTokenId) {
        headers["Authorization"] = `Bearer ${existingSessionTokenId}`;
      }

      const res = await fetch(`${API_BASE}/pay/verify`, {
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
        setTimeout(() => {
          onSuccess(data.receipt, data.sessionToken);
        }, 1500);
      } else {
        const errData = await res.json();
        setError(errData.message ?? "Payment failed");
        setStep("confirm");
      }
    } catch (e) {
      console.error("Payment failed:", e);
      setError("Payment failed. Please try again.");
      setStep("confirm");
    }
  };

  // Format Wei to XPL
  const formatXpl = (wei: string) => {
    const xpl = Number(BigInt(wei)) / 1e18;
    return xpl.toFixed(6);
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="payment-sheet-overlay" onClick={onClose}>
      <div className="payment-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="payment-sheet-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.5rem" }}>🔷</span>
            <span style={{ fontWeight: 600, fontSize: "1.125rem" }}>Decagon Payment</span>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Countdown */}
        <div className="payment-sheet-timer">
          <span style={{ color: countdown < 60 ? "var(--error)" : "var(--text-secondary)" }}>
            Expires in {formatCountdown(countdown)}
          </span>
        </div>

        {/* Error display */}
        {error && (
          <div className="payment-sheet-error">
            {error}
          </div>
        )}

        {/* Step: Email */}
        {step === "email" && (
          <div className="payment-sheet-step">
            <h3>Welcome to Decagon</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
              Enter your email to continue with the payment.
            </p>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="payment-input"
              autoFocus
            />
            <button className="btn btn-primary btn-full" onClick={handleEmailSubmit}>
              Continue →
            </button>
          </div>
        )}

        {/* Step: Policy Check (loading) */}
        {step === "policy" && (
          <div className="payment-sheet-step">
            <div className="spinner-container">
              <div className="spinner"></div>
            </div>
            <p style={{ textAlign: "center", color: "var(--text-secondary)" }}>
              Checking spend policy...
            </p>
          </div>
        )}

        {/* Step: Blocked */}
        {step === "blocked" && policyResult && (
          <div className="payment-sheet-step">
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <span style={{ fontSize: "3rem" }}>🚫</span>
              <h3 style={{ marginTop: "1rem", color: "var(--error)" }}>Payment Blocked</h3>
            </div>
            <div className="policy-block-reason">
              <p><strong>Reason:</strong> {policyResult.error?.reason?.replace(/_/g, " ") ?? "Policy violation"}</p>
              <p>{policyResult.error?.message}</p>
            </div>
            <div className="policy-details">
              <p><strong>Your Policy:</strong></p>
              <ul>
                <li>Max per action: {formatPrice(policyResult.policy.maxPerActionCents)}</li>
                <li>Daily cap: {formatPrice(policyResult.policy.dailyCapCents)}</li>
                <li>Today&apos;s spend: {formatPrice(policyResult.currentDailySpend)}</li>
              </ul>
            </div>
            <button className="btn btn-secondary btn-full" onClick={onClose}>
              Close
            </button>
            <a href="/settings" className="settings-link">
              Update spend policy →
            </a>
          </div>
        )}

        {/* Step: Confirm */}
        {step === "confirm" && (
          <div className="payment-sheet-step">
            <h3>Confirm Purchase</h3>
            
            <div className="payment-summary">
              <div className="payment-summary-row">
                <span>Credits</span>
                <span className="payment-value">{challenge.creditsOffered}</span>
              </div>
              <div className="payment-summary-row">
                <span>Price (USD)</span>
                <span className="payment-value">{formatPrice(challenge.amountRequired)}</span>
              </div>
              <div className="payment-summary-row">
                <span>Pay with</span>
                <span className="payment-value">{formatXpl(challenge.amountWei)} {challenge.assetSymbol}</span>
              </div>
              <div className="payment-summary-row">
                <span>Chain</span>
                <span className="payment-value">{challenge.chain}</span>
              </div>
              <div className="payment-summary-row">
                <span>Recipient</span>
                <span className="payment-value" style={{ fontSize: "0.75rem" }}>
                  {challenge.payeeAddress?.slice(0, 6)}...{challenge.payeeAddress?.slice(-4)}
                </span>
              </div>
              <div className="payment-summary-divider" />
              <div className="payment-summary-row">
                <span>Cost per unlock</span>
                <span className="payment-value">1 credit</span>
              </div>
            </div>

            {policyResult && (
              <div className="policy-summary">
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Spend Policy: max {formatPrice(policyResult.policy.maxPerActionCents)}/action, 
                  {formatPrice(policyResult.policy.dailyCapCents - policyResult.currentDailySpend)} remaining today
                </p>
              </div>
            )}

            {(policyResult?.needsConfirm || challenge.amountRequired > 100) && (
              <label className="confirm-checkbox">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                />
                <span>I confirm this purchase</span>
              </label>
            )}

            {hasMetaMask ? (
              <button 
                className="btn btn-success btn-full" 
                onClick={handlePayment}
                disabled={(policyResult?.needsConfirm && !confirmChecked)}
              >
                🦊 Pay with MetaMask ({formatXpl(challenge.amountWei)} XPL)
              </button>
            ) : (
              <button 
                className="btn btn-success btn-full" 
                onClick={handleMockPayment}
                disabled={policyResult?.needsConfirm && !confirmChecked}
              >
                Pay {formatPrice(challenge.amountRequired)} (Demo Mode)
              </button>
            )}

            {hasMetaMask && (
              <button 
                className="btn btn-secondary btn-full" 
                onClick={handleMockPayment}
                disabled={policyResult?.needsConfirm && !confirmChecked}
              >
                Skip wallet (Demo Mode)
              </button>
            )}
            
            <button className="btn btn-ghost btn-full" onClick={onClose}>
              Cancel
            </button>
          </div>
        )}

        {/* Step: Connecting Wallet */}
        {step === "connecting" && (
          <div className="payment-sheet-step">
            <div className="spinner-container">
              <div className="spinner"></div>
            </div>
            <p style={{ textAlign: "center", color: "var(--text-secondary)" }}>
              Connecting wallet...
            </p>
            <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Please approve the connection in MetaMask
            </p>
          </div>
        )}

        {/* Step: Sending Transaction */}
        {step === "sending" && (
          <div className="payment-sheet-step">
            <div className="spinner-container">
              <div className="spinner"></div>
            </div>
            <p style={{ textAlign: "center", color: "var(--text-secondary)" }}>
              Sending transaction...
            </p>
            <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Please confirm the transaction in MetaMask
            </p>
            {walletAddress && (
              <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                From: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </p>
            )}
          </div>
        )}

        {/* Step: Confirming on Chain */}
        {step === "confirming" && (
          <div className="payment-sheet-step">
            <div className="spinner-container">
              <div className="spinner"></div>
            </div>
            <p style={{ textAlign: "center", color: "var(--text-secondary)" }}>
              Confirming on chain...
            </p>
            {txHash && (
              <a 
                href={`${challenge.explorerTxBase || PLASMA_EXPLORER_TX_BASE}${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "block", textAlign: "center", fontSize: "0.75rem", color: "var(--primary)", marginTop: "0.5rem" }}
              >
                View on Explorer →
              </a>
            )}
          </div>
        )}

        {/* Step: Success */}
        {step === "success" && (
          <div className="payment-sheet-step">
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: "4rem" }}>✓</span>
              <h3 style={{ marginTop: "1rem", color: "var(--success)" }}>Payment Successful!</h3>
              <p style={{ color: "var(--text-secondary)" }}>
                You now have {challenge.creditsOffered} credits.
              </p>
            </div>

            {(txHash || receipt?.txHash) && (
              <div className="receipt-details">
                <div className="payment-summary-row">
                  <span>Transaction</span>
                  <span className="payment-value" style={{ fontSize: "0.75rem" }}>
                    {(txHash || receipt?.txHash)?.slice(0, 10)}...{(txHash || receipt?.txHash)?.slice(-6)}
                  </span>
                </div>
                {receipt?.blockNumber && (
                  <div className="payment-summary-row">
                    <span>Block</span>
                    <span className="payment-value">#{receipt.blockNumber}</span>
                  </div>
                )}
                {receipt?.amountNative && (
                  <div className="payment-summary-row">
                    <span>Amount</span>
                    <span className="payment-value">{receipt.amountNative}</span>
                  </div>
                )}
                <a 
                  href={receipt?.explorerUrl || `${challenge.explorerTxBase || PLASMA_EXPLORER_TX_BASE}${txHash || receipt?.txHash}`}
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

        {/* Footer */}
        <div className="payment-sheet-footer">
          <span>Powered by Decagon</span>
          <a href="/settings">Settings</a>
        </div>
      </div>

      <style jsx>{`
        .payment-sheet-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 1000;
        }

        .payment-sheet {
          background: var(--card-bg);
          border-radius: 16px 16px 0 0;
          width: 100%;
          max-width: 420px;
          max-height: 90vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .payment-sheet-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--border);
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: var(--text-secondary);
          padding: 0.25rem 0.5rem;
        }

        .close-btn:hover {
          color: var(--text);
        }

        .payment-sheet-timer {
          padding: 0.5rem 1.5rem;
          background: var(--bg-secondary);
          font-size: 0.75rem;
          text-align: center;
        }

        .payment-sheet-error {
          padding: 0.75rem 1.5rem;
          background: rgba(239, 68, 68, 0.1);
          color: var(--error);
          font-size: 0.875rem;
        }

        .payment-sheet-step {
          padding: 1.5rem;
        }

        .payment-sheet-step h3 {
          margin-bottom: 0.5rem;
        }

        .payment-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg-secondary);
          color: var(--text);
          font-size: 1rem;
          margin-bottom: 1rem;
        }

        .payment-input:focus {
          outline: none;
          border-color: var(--primary);
        }

        .spinner-container {
          display: flex;
          justify-content: center;
          padding: 2rem 0;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--border);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .payment-summary {
          background: var(--bg-secondary);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .payment-summary-row {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
        }

        .payment-value {
          font-weight: 600;
        }

        .payment-summary-divider {
          height: 1px;
          background: var(--border);
          margin: 0.5rem 0;
        }

        .policy-summary {
          margin-bottom: 1rem;
        }

        .policy-block-reason {
          background: rgba(239, 68, 68, 0.1);
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
        }

        .policy-details {
          background: var(--bg-secondary);
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          font-size: 0.875rem;
        }

        .policy-details ul {
          margin: 0.5rem 0 0 1rem;
          padding: 0;
        }

        .confirm-checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
          cursor: pointer;
        }

        .confirm-checkbox input {
          width: 18px;
          height: 18px;
        }

        .btn-full {
          width: 100%;
          margin-bottom: 0.5rem;
        }

        .btn-ghost {
          background: transparent;
          color: var(--text-secondary);
        }

        .btn-ghost:hover {
          background: var(--bg-secondary);
          color: var(--text);
        }

        .settings-link {
          display: block;
          text-align: center;
          color: var(--primary);
          font-size: 0.875rem;
          margin-top: 1rem;
        }

        .receipt-details {
          background: var(--bg-secondary);
          border-radius: 8px;
          padding: 1rem;
          margin-top: 1.5rem;
        }

        .payment-sheet-footer {
          display: flex;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border);
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .payment-sheet-footer a {
          color: var(--primary);
        }

        @media (min-width: 640px) {
          .payment-sheet-overlay {
            align-items: center;
          }

          .payment-sheet {
            border-radius: 16px;
            max-height: 80vh;
          }
        }
      `}</style>
    </div>
  );
}
