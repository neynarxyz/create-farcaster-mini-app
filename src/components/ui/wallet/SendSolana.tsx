"use client";

import { useCallback, useState } from "react";
import { useConnection as useSolanaConnection, useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { Button } from "../Button";
import { truncateAddress } from "../../../lib/truncateAddress";
import { renderError } from "../../../lib/errorUtils";

/**
 * SendSolana component handles sending SOL transactions on Solana.
 * 
 * This component provides a simple interface for users to send SOL transactions
 * using their connected Solana wallet. It includes transaction status tracking
 * and error handling.
 * 
 * Features:
 * - SOL transaction sending
 * - Transaction status tracking
 * - Error handling and display
 * - Loading state management
 * 
 * Note: This component is a placeholder implementation. In a real application,
 * you would integrate with a Solana wallet adapter and transaction library
 * like @solana/web3.js to handle actual transactions.
 * 
 * @example
 * ```tsx
 * <SendSolana />
 * ```
 */
export function SendSolana() {
  const [solanaTransactionState, setSolanaTransactionState] = useState<
    | { status: 'none' }
    | { status: 'pending' }
    | { status: 'error'; error: Error }
    | { status: 'success'; signature: string }
  >({ status: 'none' });

  const { connection: solanaConnection } = useSolanaConnection();
  const { sendTransaction, publicKey } = useSolanaWallet();

  // This should be replaced but including it from the original demo
  // https://github.com/farcasterxyz/frames-v2-demo/blob/main/src/components/Demo.tsx#L718
  const ashoatsPhantomSolanaWallet = 'Ao3gLNZAsbrmnusWVqQCPMrcqNi6jdYgu8T6NCoXXQu1';

  /**
   * Handles sending the Solana transaction
   */
  const sendSolanaTransaction = useCallback(async () => {
    setSolanaTransactionState({ status: 'pending' });
    try {
      if (!publicKey) {
        throw new Error('no Solana publicKey');
      }

      const { blockhash } = await solanaConnection.getLatestBlockhash();
      if (!blockhash) {
        throw new Error('failed to fetch latest Solana blockhash');
      }

      const fromPubkeyStr = publicKey.toBase58();
      const toPubkeyStr = ashoatsPhantomSolanaWallet;
      const transaction = new Transaction();
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(fromPubkeyStr),
          toPubkey: new PublicKey(toPubkeyStr),
          lamports: 0n,
        }),
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(fromPubkeyStr);

      const simulation = await solanaConnection.simulateTransaction(transaction);
      if (simulation.value.err) {
        // Gather logs and error details for debugging
        const logs = simulation.value.logs?.join('\n') ?? 'No logs';
        const errDetail = JSON.stringify(simulation.value.err);
        throw new Error(`Simulation failed: ${errDetail}\nLogs:\n${logs}`);
      }
      const signature = await sendTransaction(transaction, solanaConnection);
      setSolanaTransactionState({ status: 'success', signature });
    } catch (e) {
      if (e instanceof Error) {
        setSolanaTransactionState({ status: 'error', error: e });
      } else {
        setSolanaTransactionState({ status: 'none' });
      }
    }
  }, [sendTransaction, publicKey, solanaConnection]);

  return (
    <>
      <Button
        onClick={sendSolanaTransaction}
        disabled={solanaTransactionState.status === 'pending'}
        isLoading={solanaTransactionState.status === 'pending'}
        className="mb-4"
      >
        Send Transaction (sol)
      </Button>
      {solanaTransactionState.status === 'error' && renderError(solanaTransactionState.error)}
      {solanaTransactionState.status === 'success' && (
        <div className="mt-2 text-xs">
          <div>Hash: {truncateAddress(solanaTransactionState.signature)}</div>
        </div>
      )}
    </>
  );
} 