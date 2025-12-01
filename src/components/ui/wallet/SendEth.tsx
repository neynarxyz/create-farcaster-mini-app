"use client";

import { useCallback, useMemo } from "react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { arbitrum, base, mainnet, optimism, polygon, scroll, shape, zkSync, zora } from "wagmi/chains";
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
   * Uses different protocol guild addresses for different chains.
   * Defaults to Ethereum mainnet address if chain is not recognized.
   * Addresses are taken from the protocol guilds documentation: https://protocol-guild.readthedocs.io/en/latest/
   *
   * @returns string - The recipient address for the current chain
   */
  const protocolGuildRecipientAddress = useMemo(() => {
    switch (chainId) {
      case mainnet.id:
        return "0x25941dC771bB64514Fc8abBce970307Fb9d477e9";
      case arbitrum.id:
        return "0x7F8DCFd764bA8e9B3BA577dC641D5c664B74c47b";
      case base.id:
        return "0xd16713A5D4Eb7E3aAc9D2228eB72f6f7328FADBD";
      case optimism.id:
        return "0x58ae0925077527a87D3B785aDecA018F9977Ec34";
      case polygon.id:
        return "0xccccEbdBdA2D68bABA6da99449b9CA41Dba9d4FF";
      case scroll.id:
        return "0xccccEbdBdA2D68bABA6da99449b9CA41Dba9d4FF";
      case shape.id:
        return "0x700fccD433E878F1AF9B64A433Cb2E09f5226CE8";
      case zkSync.id:
        return "0x9fb5F754f5222449F98b904a34494cB21AADFdf8";
      case zora.id:
        return "0x32e3C7fD24e175701A35c224f2238d18439C7dBC";
      default:
        // Default to Ethereum mainnet address
        return "0x25941dC771bB64514Fc8abBce970307Fb9d477e9";
    }
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