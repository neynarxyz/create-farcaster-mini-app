"use client";

import { useCallback, useState } from "react";
import { Button } from "../Button";
import { renderError } from "../../../lib/errorUtils";

interface SignSolanaMessageProps {
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
}

/**
 * SignSolanaMessage component handles signing messages on Solana.
 * 
 * This component provides a simple interface for users to sign messages using
 * their connected Solana wallet. It accepts a signMessage function as a prop
 * and handles the complete signing flow including error handling.
 * 
 * Features:
 * - Message signing with Solana wallet
 * - Error handling and display
 * - Signature result display (base64 encoded)
 * - Loading state management
 * 
 * @param props - Component props
 * @param props.signMessage - Function to sign messages with Solana wallet
 * 
 * @example
 * ```tsx
 * <SignSolanaMessage signMessage={solanaWallet.signMessage} />
 * ```
 */
export function SignSolanaMessage({ signMessage }: SignSolanaMessageProps) {
  // --- State ---
  const [signature, setSignature] = useState<string | undefined>();
  const [signError, setSignError] = useState<Error | undefined>();
  const [signPending, setSignPending] = useState(false);

  // --- Handlers ---
  /**
   * Handles the Solana message signing process.
   * 
   * This function encodes a message as UTF-8 bytes, signs it using the provided
   * signMessage function, and displays the base64-encoded signature result.
   * It includes comprehensive error handling and loading state management.
   * 
   * @returns Promise<void>
   */
  const handleSignMessage = useCallback(async () => {
    setSignPending(true);
    try {
      if (!signMessage) {
        throw new Error('no Solana signMessage');
      }
      const input = new TextEncoder().encode("Hello from Solana!");
      const signatureBytes = await signMessage(input);
      const signature = btoa(String.fromCharCode(...signatureBytes));
      setSignature(signature);
      setSignError(undefined);
    } catch (e) {
      if (e instanceof Error) {
        setSignError(e);
      }
    } finally {
      setSignPending(false);
    }
  }, [signMessage]);

  // --- Render ---
  return (
    <>
      <Button
        onClick={handleSignMessage}
        disabled={signPending}
        isLoading={signPending}
        className="mb-4"
      >
        Sign Message
      </Button>
      {signError && renderError(signError)}
      {signature && (
        <div className="mt-2 text-xs">
          <div>Signature: {signature}</div>
        </div>
      )}
    </>
  );
} 