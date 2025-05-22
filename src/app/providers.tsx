"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { Session } from "next-auth"
import { SessionProvider } from "next-auth/react"
import { FrameProvider } from "~/components/providers/FrameProvider";
import { SolanaWalletDemo } from "../components/SolanaWalletDemo";

const WagmiProvider = dynamic(
  () => import("~/components/providers/WagmiProvider"),
  {
    ssr: false,
  }
);

const FarcasterSolanaProvider = dynamic(
  () => import('@farcaster/mini-app-solana').then(mod => mod.FarcasterSolanaProvider),
  { ssr: false }
);

export function Providers({ session, children }: { session: Session | null, children: React.ReactNode }) {
  const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_ENDPOINT || "https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY";
  return (
    <SessionProvider session={session}>
      <WagmiProvider>
        <FrameProvider>
          <FarcasterSolanaProvider endpoint={solanaEndpoint}>
            <SolanaWalletDemo />
            {children}
          </FarcasterSolanaProvider>
        </FrameProvider>
      </WagmiProvider>
    </SessionProvider>
  );
}
