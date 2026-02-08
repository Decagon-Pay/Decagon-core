import { Effect } from "effect";
import type { ApiError, PaymentChallenge, PaymentRequiredError } from "@decagon/x402";
import { TOPUP_CREDITS, TOPUP_PRICE_CENTS, CHALLENGE_EXPIRY_MINUTES } from "@decagon/x402";
import { ChallengesStore, Clock, IdGen, Logger, ChainConfigService } from "../capabilities/index.js";
import {
  verifyPaymentAndIssueSession,
  type VerifyPaymentInput,
  type VerifyPaymentOutput,
} from "./verify-payment.js";
import { ReceiptsStore, PaymentVerifier } from "../capabilities/index.js";

export interface CreateTransferInput {
  readonly senderUserId: string;
  readonly recipientAddress: string;
  readonly amountCents: number;
  readonly note?: string;
}

export interface TransferChallenge {
  readonly challenge: PaymentChallenge;
  readonly recipientAddress: string;
  readonly note?: string;
}

type TransferCapabilities = ChallengesStore | Clock | IdGen | Logger | ChainConfigService;

const paymentRequired = (challenge: PaymentChallenge): PaymentRequiredError => ({
  _tag: "PaymentRequiredError",
  message: "Payment required to complete this transfer",
  timestamp: new Date().toISOString(),
  challenge,
});

export const createTransfer = (
  input: CreateTransferInput
): Effect.Effect<TransferChallenge, ApiError, TransferCapabilities> =>
  Effect.gen(function* () {
    const idGen = yield* IdGen;
    const clock = yield* Clock;
    const challengesStore = yield* ChallengesStore;
    const chainConfig = yield* ChainConfigService;
    const logger = yield* Logger;

    const challengeId = yield* idGen.challengeId();
    const now = yield* clock.now();
    const expiresAt = yield* clock.futureMinutes(CHALLENGE_EXPIRY_MINUTES);
    const config = yield* chainConfig.getConfig();

    const challenge: PaymentChallenge = {
      challengeId,
      resourceId: `transfer:${input.recipientAddress}`,
      amountRequired: input.amountCents || TOPUP_PRICE_CENTS,
      currency: "USDT",
      chain: config.chainName,
      description: input.note ?? "Remittance transfer",
      payTo: config.payeeAddress,
      expiresAt,
      createdAt: now,
      creditsOffered: TOPUP_CREDITS,
      status: "pending",
      chainId: config.chainId,
      assetType: config.assetType,
      assetSymbol: config.assetSymbol,
      amountWei: config.topupPriceWei,
      payeeAddress: config.payeeAddress,
      explorerTxBase: config.explorerTxBase,
    };

    yield* challengesStore.save(challenge);
    yield* logger.info("Transfer challenge created", {
      challengeId,
      recipient: input.recipientAddress,
      amountCents: input.amountCents,
    });

    return {
      challenge,
      recipientAddress: input.recipientAddress,
      note: input.note,
    };
  });

export const verifyTransfer = (
  input: VerifyPaymentInput
): Effect.Effect<
  VerifyPaymentOutput,
  ApiError,
  ReceiptsStore | ChallengesStore | Clock | IdGen | Logger | PaymentVerifier
> => verifyPaymentAndIssueSession(input);
