import * as React from "react";
import { useWallet } from "@solana/wallet-adapter-react";

export function SolanaWalletDemo() {
  const { publicKey } = useWallet();
  const solanaAddress = publicKey?.toBase58() ?? "";
  return (
    <div style={{ padding: 16, background: "#f6f6f6", borderRadius: 8, margin: 16 }}>
      <h3>Solana Wallet Demo</h3>
      <div>
        <strong>Solana Address:</strong>
        <span style={{ marginLeft: 8 }}>{solanaAddress || "Not connected"}</span>
      </div>
    </div>
  );
}
