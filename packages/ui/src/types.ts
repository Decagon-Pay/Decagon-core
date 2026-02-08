export interface DecagonChallenge {
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
  chainId: number;
  assetType: "NATIVE" | "ERC20";
  assetSymbol: string;
  amountWei: string;
  payeeAddress: string;
  explorerTxBase: string;
}

export interface DecagonReceipt {
  receiptId: string;
  txHash?: string;
  explorerUrl?: string;
  blockNumber?: number;
  amountNative?: string;
}

export interface DecagonPolicyResult {
  allowed: boolean;
  needsConfirm?: boolean;
  subjectType: string;
  subjectId: string;
  policy: DecagonSpendPolicy;
  currentDailySpend: number;
  error?: {
    _tag: string;
    message: string;
    reason: string;
  };
}

export interface DecagonSpendPolicy {
  maxPerActionCents: number;
  dailyCapCents: number;
  autoApproveUnderCents: number;
  requireConfirmAboveCents: number;
  allowedOrigins: string[];
  allowedPaths: string[];
}

export interface DecagonPaymentConfig {
  apiBase: string;
  plasmaChainId: number;
  explorerTxBase: string;
}

export interface OpenDecagonPaymentOptions {
  challenge: DecagonChallenge;
  config: DecagonPaymentConfig;
  existingSessionTokenId?: string;
  purpose?: string;
  onSuccess: (receipt: DecagonReceipt, sessionToken: unknown) => void;
  onClose?: () => void;
}

export type PaymentStep =
  | "email"
  | "policy"
  | "confirm"
  | "connecting"
  | "sending"
  | "confirming"
  | "success"
  | "blocked";
