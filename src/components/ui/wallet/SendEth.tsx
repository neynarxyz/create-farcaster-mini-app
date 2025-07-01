"use client";

import { useCallback, useMemo } from "react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { base } from "wagmi/chains";
import { Button } from "../Button";
import { truncateAddress } from "../../../lib/truncateAddress";
import { renderError } from "../../../lib/errorUtils";

/**
 * SendEth component handles sending ETH transactions to protocol guild addresses.
 * 
 * This component provides a simple interface for users to send small amounts
 * of ETH to protocol guild addresses. It automatically selects the appropriate
 * recipient address based on the current chain and displays transaction status.
 * 
 * Features:
 * - Chain-specific recipient addresses
 * - Transaction status tracking
 * - Error handling and display
 * - Transaction hash display
 * 
 * @example
 * ```tsx
 * <SendEth />
 * ```
 */
export function SendEth() {
  // --- Hooks ---
  const { isConnected, chainId } = useAccount();
  const {
    sendTransaction,
    data: ethTransactionHash,
    error: ethTransactionError,
    isError: isEthTransactionError,
    isPending: isEthTransactionPending,
  } = useSendTransaction();

  const { isLoading: isEthTransactionConfirming, isSuccess: isEthTransactionConfirmed } =
    useWaitForTransactionReceipt({
      hash: ethTransactionHash,
    });

  // --- Computed Values ---
  /**
   * Determines the recipient address based on the current chain.
   * 
   * Uses different protocol guild addresses for different chains:
   * - Base: 0x32e3C7fD24e175701A35c224f2238d18439C7dBC
   * - Other chains: 0xB3d8d7887693a9852734b4D25e9C0Bb35Ba8a830
   * 
   * @returns string - The recipient address for the current chain
   */
  const protocolGuildRecipientAddress = useMemo(() => {
    // Protocol guild address
    return chainId === base.id
      ? "0x32e3C7fD24e175701A35c224f2238d18439C7dBC"
      : "0xB3d8d7887693a9852734b4D25e9C0Bb35Ba8a830";
  }, [chainId]);

  // --- Handlers ---
  /**
   * Handles sending the ETH transaction.
   * 
   * This function sends a small amount of ETH (1 wei) to the protocol guild
   * address for the current chain. The transaction is sent using the wagmi
   * sendTransaction hook.
   */
  const sendEthTransaction = useCallback(() => {
    sendTransaction({
      to: protocolGuildRecipientAddress,
      value: 1n,
    });
  }, [protocolGuildRecipientAddress, sendTransaction]);

  // --- Render ---
  return (
    <>
      <Button
        onClick={sendEthTransaction}
        disabled={!isConnected || isEthTransactionPending}
        isLoading={isEthTransactionPending}
      >
        Send Transaction (eth)
      </Button>
      {isEthTransactionError && renderError(ethTransactionError)}
      {ethTransactionHash && (
        <div className="mt-2 text-xs">
          <div>Hash: {truncateAddress(ethTransactionHash)}</div>
          <div>
            Status:{" "}
            {isEthTransactionConfirming
              ? "Confirming..."
              : isEthTransactionConfirmed
              ? "Confirmed!"
              : "Pending"}
          </div>
        </div>
      )}
    </>
  );
} 