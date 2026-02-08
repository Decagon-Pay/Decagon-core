"use client";

import { useState, useCallback } from "react";
import type {
  DecagonChallenge,
  DecagonReceipt,
  DecagonPaymentConfig,
  OpenDecagonPaymentOptions,
} from "./types";

export interface UseDecagonPaymentReturn {
  isOpen: boolean;
  challenge: DecagonChallenge | null;
  config: DecagonPaymentConfig | null;
  purpose: string | undefined;
  existingSessionTokenId: string | undefined;
  open: (options: OpenDecagonPaymentOptions) => void;
  close: () => void;
  onSuccess: (receipt: DecagonReceipt, sessionToken: unknown) => void;
}

export function useDecagonPayment(): UseDecagonPaymentReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [challenge, setChallenge] = useState<DecagonChallenge | null>(null);
  const [config, setConfig] = useState<DecagonPaymentConfig | null>(null);
  const [purpose, setPurpose] = useState<string | undefined>();
  const [existingSessionTokenId, setExistingSessionTokenId] = useState<string | undefined>();
  const [successHandler, setSuccessHandler] = useState<
    ((receipt: DecagonReceipt, sessionToken: unknown) => void) | null
  >(null);
  const [closeHandler, setCloseHandler] = useState<(() => void) | null>(null);

  const open = useCallback((options: OpenDecagonPaymentOptions) => {
    setChallenge(options.challenge);
    setConfig(options.config);
    setPurpose(options.purpose);
    setExistingSessionTokenId(options.existingSessionTokenId);
    setSuccessHandler(() => options.onSuccess);
    setCloseHandler(() => options.onClose ?? null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    closeHandler?.();
  }, [closeHandler]);

  const onSuccess = useCallback(
    (receipt: DecagonReceipt, sessionToken: unknown) => {
      successHandler?.(receipt, sessionToken);
      setIsOpen(false);
    },
    [successHandler]
  );

  return { isOpen, challenge, config, purpose, existingSessionTokenId, open, close, onSuccess };
}
