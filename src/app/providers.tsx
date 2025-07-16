'use client';

import dynamic from 'next/dynamic';
import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import { MiniAppProvider } from '@neynar/react';
import { SafeFarcasterSolanaProvider } from '~/components/providers/SafeFarcasterSolanaProvider';
import { ANALYTICS_ENABLED } from '~/lib/constants';
import { AuthKitProvider } from '@farcaster/auth-kit';

const WagmiProvider = dynamic(
  () => import('~/components/providers/WagmiProvider'),
  {
    ssr: false,
  }
);

export function Providers({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  const solanaEndpoint =
    process.env.SOLANA_RPC_ENDPOINT || 'https://solana-rpc.publicnode.com';
  
  // Only wrap with SessionProvider if next auth is used
  if (process.env.SPONSOR_SIGNER === 'true' || process.env.SEED_PHRASE) {
    return (
      <SessionProvider session={session}>
        <WagmiProvider>
          <MiniAppProvider
            analyticsEnabled={ANALYTICS_ENABLED}
            backButtonEnabled={true}
          >
            <SafeFarcasterSolanaProvider endpoint={solanaEndpoint}>
              <AuthKitProvider config={{}}>{children}</AuthKitProvider>
            </SafeFarcasterSolanaProvider>
          </MiniAppProvider>
        </WagmiProvider>
      </SessionProvider>
    );
  }
  
  // Return without SessionProvider if no session
  return (
    <WagmiProvider>
      <MiniAppProvider
        analyticsEnabled={ANALYTICS_ENABLED}
        backButtonEnabled={true}
      >
        <SafeFarcasterSolanaProvider endpoint={solanaEndpoint}>
          <AuthKitProvider config={{}}>{children}</AuthKitProvider>
        </SafeFarcasterSolanaProvider>
      </MiniAppProvider>
    </WagmiProvider>
  );
}
