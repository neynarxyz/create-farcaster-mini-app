"use client";

import { useCallback } from "react";
import { useAccount, useConnect, useSignMessage } from "wagmi";
import { base } from "wagmi/chains";
import { Button } from "../Button";
import { config } from "../../providers/WagmiProvider";
import { APP_NAME } from "../../../lib/constants";
import { renderError } from "../../../lib/errorUtils";

/**
 * SignEvmMessage component handles signing messages on EVM-compatible chains.
 * 
 * This component provides a simple interface for users to sign messages using
 * their connected EVM wallet. It automatically handles wallet connection if
 * the user is not already connected, and displays the signature result.
 * 
 * Features:
 * - Automatic wallet connection if needed
 * - Message signing with app name
 * - Error handling and display
 * - Signature result display
 * 
 * @example
 * ```tsx
 * <SignEvmMessage />
 * ```
 */
export function SignEvmMessage() {
  // --- Hooks ---
  const { isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const {
    signMessage,
    data: evmMessageSignature,
    error: evmSignMessageError,
    isError: isEvmSignMessageError,
    isPending: isEvmSignMessagePending,
  } = useSignMessage();

  // --- Handlers ---
  /**
   * Handles the message signing process.
   * 
   * This function first ensures the user is connected to an EVM wallet,
   * then requests them to sign a message containing the app name.
   * If the user is not connected, it automatically connects using the
   * Farcaster Frame connector.
   * 
   * @returns Promise<void>
   */
  const signEvmMessage = useCallback(async () => {
    if (!isConnected) {
      await connectAsync({
        chainId: base.id,
        connector: config.connectors[0],
      });
    }

    signMessage({ message: `Hello from ${APP_NAME}!` });
  }, [connectAsync, isConnected, signMessage]);

  // --- Render ---
  return (
    <>
      <Button
        onClick={signEvmMessage}
        disabled={isEvmSignMessagePending}
        isLoading={isEvmSignMessagePending}
      >
        Sign Message
      </Button>
      {isEvmSignMessageError && renderError(evmSignMessageError)}
      {evmMessageSignature && (
        <div className="mt-2 text-xs">
          <div>Signature: {evmMessageSignature}</div>
        </div>
      )}
    </>
  );
} 