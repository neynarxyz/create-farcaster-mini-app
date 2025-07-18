'use client';

import dynamic from 'next/dynamic';
import { MiniAppProvider } from '@neynar/react';
import { SafeFarcasterSolanaProvider } from '~/components/providers/SafeFarcasterSolanaProvider';
import { ANALYTICS_ENABLED } from '~/lib/constants';

const WagmiProvider = dynamic(
  () => import('~/components/providers/WagmiProvider'),
  {
    ssr: false,
  }
);

export function Providers({
  session,
  children,
  shouldUseSession = false,
}: {
  session: unknown | null;
  children: React.ReactNode;
  shouldUseSession?: boolean;
}) {
  const solanaEndpoint =
    process.env.SOLANA_RPC_ENDPOINT || 'https://solana-rpc.publicnode.com';

  // Only wrap with SessionProvider if next auth is used
  if (shouldUseSession) {
    // Dynamic import for auth components - will work if modules exist, fallback if not
    const AuthWrapper = dynamic(
      () => {
        return Promise.resolve().then(() => {
          // Use eval to avoid build-time module resolution
          try {
            const nextAuth = eval('require("next-auth/react")');
            const authKit = eval('require("@farcaster/auth-kit")');

            const AuthWrapper = ({
              children,
            }: {
              children: React.ReactNode;
            }) => (
              <nextAuth.SessionProvider session={session}>
                <authKit.AuthKitProvider config={{}}>
                  {children}
                </authKit.AuthKitProvider>
              </nextAuth.SessionProvider>
            );
            AuthWrapper.displayName = 'AuthWrapper';
            return AuthWrapper;
          } catch (_error) {
            // Fallback component when auth modules aren't available
            const FallbackWrapper = ({
              children,
            }: {
              children: React.ReactNode;
            }) => <>{children}</>;
            FallbackWrapper.displayName = 'FallbackWrapper';
            return FallbackWrapper;
          }
        });
      },
      { ssr: false }
    );

    return (
      <WagmiProvider>
        <MiniAppProvider
          analyticsEnabled={ANALYTICS_ENABLED}
          backButtonEnabled={true}
        >
          <SafeFarcasterSolanaProvider endpoint={solanaEndpoint}>
            <AuthWrapper>{children}</AuthWrapper>
          </SafeFarcasterSolanaProvider>
        </MiniAppProvider>
      </WagmiProvider>
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
          {children}
        </SafeFarcasterSolanaProvider>
      </MiniAppProvider>
    </WagmiProvider>
  );
}
