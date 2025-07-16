"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { useAccount, useSendTransaction, useSignTypedData, useWaitForTransactionReceipt, useDisconnect, useConnect, useSwitchChain, useChainId, type Connector } from "wagmi";
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { base, degen, mainnet, optimism, unichain } from "wagmi/chains";
import { Button } from "../Button";
import { truncateAddress } from "../../../lib/truncateAddress";
import { renderError } from "../../../lib/errorUtils";
import { SignEvmMessage } from "../wallet/SignEvmMessage";
import { SendEth } from "../wallet/SendEth";
import { SignSolanaMessage } from "../wallet/SignSolanaMessage";
import { SendSolana } from "../wallet/SendSolana";
import { USE_WALLET, APP_NAME } from "../../../lib/constants";
import { useMiniApp } from "@neynar/react";

/**
 * WalletTab component manages wallet-related UI for both EVM and Solana chains.
 * 
 * This component provides a comprehensive wallet interface that supports:
 * - EVM wallet connections (Farcaster Frame, Coinbase Wallet, MetaMask)
 * - Solana wallet integration
 * - Message signing for both chains
 * - Transaction sending for both chains
 * - Chain switching for EVM chains
 * - Auto-connection in Farcaster clients
 * 
 * The component automatically detects when running in a Farcaster client
 * and attempts to auto-connect using the Farcaster Frame connector.
 * 
 * @example
 * ```tsx
 * <WalletTab />
 * ```
 */

interface WalletStatusProps {
  address?: string;
  chainId?: number;
}

/**
 * Displays the current wallet address and chain ID.
 */
function WalletStatus({ address, chainId }: WalletStatusProps) {
  return (
    <>
      {address && (
        <div className="text-xs w-full">
          Address: <pre className="inline w-full">{truncateAddress(address)}</pre>
        </div>
      )}
      {chainId && (
        <div className="text-xs w-full">
          Chain ID: <pre className="inline w-full">{chainId}</pre>
        </div>
      )}
    </>
  );
}

interface ConnectionControlsProps {
  isConnected: boolean;
  context: {
    user?: { fid?: number };
    client?: unknown;
  } | null;
  connect: (args: { connector: Connector }) => void;
  connectors: readonly Connector[];
  disconnect: () => void;
}

/**
 * Renders wallet connection controls based on connection state and context.
 */
function ConnectionControls({
  isConnected,
  context,
  connect,
  connectors,
  disconnect,
}: ConnectionControlsProps) {
  if (isConnected) {
    return (
      <Button onClick={() => disconnect()} className="w-full">
        Disconnect
      </Button>
    );
  }
  if (context) {
    return (
      <div className="space-y-2 w-full">
        <Button onClick={() => connect({ connector: connectors[0] })} className="w-full">
          Connect (Auto)
        </Button>
        <Button
          onClick={() => {
            console.log("Manual Farcaster connection attempt");
            console.log("Connectors:", connectors.map((c, i) => `${i}: ${c.name}`));
            connect({ connector: connectors[0] });
          }}
          className="w-full"
        >
          Connect Farcaster (Manual)
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-3 w-full">
      <Button onClick={() => connect({ connector: connectors[1] })} className="w-full">
        Connect Coinbase Wallet
      </Button>
      <Button onClick={() => connect({ connector: connectors[2] })} className="w-full">
        Connect MetaMask
      </Button>
    </div>
  );
}

export function WalletTab() {
  // --- State ---
  const [evmContractTransactionHash, setEvmContractTransactionHash] = useState<string | null>(null);
  
  // --- Hooks ---
  const { context } = useMiniApp();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const solanaWallet = useSolanaWallet();
  const { publicKey: solanaPublicKey } = solanaWallet;

  // --- Wagmi Hooks ---
  const {
    sendTransaction,
    error: evmTransactionError,
    isError: isEvmTransactionError,
    isPending: isEvmTransactionPending,
  } = useSendTransaction();

  const { isLoading: isEvmTransactionConfirming, isSuccess: isEvmTransactionConfirmed } =
    useWaitForTransactionReceipt({
      hash: evmContractTransactionHash as `0x${string}`,
    });

  const {
    signTypedData,
    error: evmSignTypedDataError,
    isError: isEvmSignTypedDataError,
    isPending: isEvmSignTypedDataPending,
  } = useSignTypedData();

  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();

  const {
    switchChain,
    error: chainSwitchError,
    isError: isChainSwitchError,
    isPending: isChainSwitchPending,
  } = useSwitchChain();

  // --- Effects ---
  /**
   * Auto-connect when Farcaster context is available.
   * 
   * This effect detects when the app is running in a Farcaster client
   * and automatically attempts to connect using the Farcaster Frame connector.
   * It includes comprehensive logging for debugging connection issues.
   */
  useEffect(() => {
    // Check if we're in a Farcaster client environment
    const isInFarcasterClient = typeof window !== 'undefined' && 
      (window.location.href.includes('warpcast.com') || 
       window.location.href.includes('farcaster') ||
       window.ethereum?.isFarcaster ||
       context?.client);
    
    if (context?.user?.fid && !isConnected && connectors.length > 0 && isInFarcasterClient) {
      console.log("Attempting auto-connection with Farcaster context...");
      console.log("- User FID:", context.user.fid);
      console.log("- Available connectors:", connectors.map((c, i) => `${i}: ${c.name}`));
      console.log("- Using connector:", connectors[0].name);
      console.log("- In Farcaster client:", isInFarcasterClient);
      
      // Use the first connector (farcasterFrame) for auto-connection
      try {
        connect({ connector: connectors[0] });
      } catch (error) {
        console.error("Auto-connection failed:", error);
      }
    } else {
      console.log("Auto-connection conditions not met:");
      console.log("- Has context:", !!context?.user?.fid);
      console.log("- Is connected:", isConnected);
      console.log("- Has connectors:", connectors.length > 0);
      console.log("- In Farcaster client:", isInFarcasterClient);
    }
  }, [context?.user?.fid, isConnected, connectors, connect, context?.client]);

  // --- Computed Values ---
  /**
   * Determines the next chain to switch to based on the current chain.
   * Cycles through: Base → Optimism → Degen → Mainnet → Unichain → Base
   */
  const nextChain = useMemo(() => {
    if (chainId === base.id) {
      return optimism;
    } else if (chainId === optimism.id) {
      return degen;
    } else if (chainId === degen.id) {
      return mainnet;
    } else if (chainId === mainnet.id) {
      return unichain;
    } else {
      return base;
    }
  }, [chainId]);

  // --- Handlers ---
  /**
   * Handles switching to the next chain in the rotation.
   * Uses the switchChain function from wagmi to change the active chain.
   */
  const handleSwitchChain = useCallback(() => {
    switchChain({ chainId: nextChain.id });
  }, [switchChain, nextChain.id]);

  /**
   * Sends a transaction to call the yoink() function on the Yoink contract.
   * 
   * This function sends a transaction to a specific contract address with
   * the encoded function call data for the yoink() function.
   */
  const sendEvmContractTransaction = useCallback(() => {
    sendTransaction(
      {
        // call yoink() on Yoink contract
        to: "0x4bBFD120d9f352A0BEd7a014bd67913a2007a878",
        data: "0x9846cd9efc000023c0",
      },
      {
        onSuccess: (hash) => {
          setEvmContractTransactionHash(hash);
        },
      }
    );
  }, [sendTransaction]);

  /**
   * Signs typed data using EIP-712 standard.
   * 
   * This function creates a typed data structure with the app name, version,
   * and chain ID, then requests the user to sign it.
   */
  const signTyped = useCallback(() => {
    signTypedData({
      domain: {
        name: APP_NAME,
        version: "1",
        chainId,
      },
      types: {
        Message: [{ name: "content", type: "string" }],
      },
      message: {
        content: `Hello from ${APP_NAME}!`,
      },
      primaryType: "Message",
    });
  }, [chainId, signTypedData]);

  // --- Early Return ---
  if (!USE_WALLET) {
    return null;
  }

  // --- Render ---
  return (
    <div className="space-y-3 px-6 w-full max-w-md mx-auto">
      {/* Wallet Information Display */}
      <WalletStatus address={address} chainId={chainId} />

      {/* Connection Controls */}
      <ConnectionControls
        isConnected={isConnected}
        context={context}
        connect={connect}
        connectors={connectors}
        disconnect={disconnect}
      />

      {/* EVM Wallet Components */}
      <SignEvmMessage />

      {isConnected && (
        <>
          <SendEth />
          <Button
            onClick={sendEvmContractTransaction}
            disabled={!isConnected || isEvmTransactionPending}
            isLoading={isEvmTransactionPending}
            className="w-full"
          >
            Send Transaction (contract)
          </Button>
          {isEvmTransactionError && renderError(evmTransactionError)}
          {evmContractTransactionHash && (
            <div className="text-xs w-full">
              <div>Hash: {truncateAddress(evmContractTransactionHash)}</div>
              <div>
                Status:{" "}
                {isEvmTransactionConfirming
                  ? "Confirming..."
                  : isEvmTransactionConfirmed
                  ? "Confirmed!"
                  : "Pending"}
              </div>
            </div>
          )}
          <Button
            onClick={signTyped}
            disabled={!isConnected || isEvmSignTypedDataPending}
            isLoading={isEvmSignTypedDataPending}
            className="w-full"
          >
            Sign Typed Data
          </Button>
          {isEvmSignTypedDataError && renderError(evmSignTypedDataError)}
          <Button
            onClick={handleSwitchChain}
            disabled={isChainSwitchPending}
            isLoading={isChainSwitchPending}
            className="w-full"
          >
            Switch to {nextChain.name}
          </Button>
          {isChainSwitchError && renderError(chainSwitchError)}
        </>
      )}

      {/* Solana Wallet Components */}
      {solanaPublicKey && (
        <>
          <SignSolanaMessage signMessage={solanaWallet.signMessage} />
          <SendSolana />
        </>
      )}
    </div>
  );
} 