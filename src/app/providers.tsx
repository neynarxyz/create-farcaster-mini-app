'use client';

import dynamic from 'next/dynamic';
import { MiniAppProvider } from '@neynar/react';
import { SafeFarcasterSolanaProvider } from '~/components/providers/SafeFarcasterSolanaProvider';
import { ANALYTICS_ENABLED } from '~/lib/constants';
import React, { useState, useEffect } from 'react';

const WagmiProvider = dynamic(
  () => import('~/components/providers/WagmiProvider'),
  {
    ssr: false,
  }
);

// Helper component to conditionally render auth providers
function AuthProviders({
  children,
  session,
  shouldUseSession,
}: {
  children: React.ReactNode;
  session: any;
  shouldUseSession: boolean;
}) {
  const [authComponents, setAuthComponents] = useState<{
    SessionProvider: React.ComponentType<any> | null;
    AuthKitProvider: React.ComponentType<any> | null;
    loaded: boolean;
  }>({
    SessionProvider: null,
    AuthKitProvider: null,
    loaded: false,
  });

  useEffect(() => {
    if (!shouldUseSession) {
      setAuthComponents({
        SessionProvider: null,
        AuthKitProvider: null,
        loaded: true,
      });
      return;
    }

    const loadAuthComponents = async () => {
      try {
        // Dynamic imports for auth modules
        let SessionProvider = null;
        let AuthKitProvider = null;

        try {
          const nextAuth = await import('next-auth/react');
          SessionProvider = nextAuth.SessionProvider;
        } catch (error) {
          console.warn('NextAuth not available:', error);
        }

        try {
          const authKit = await import('@farcaster/auth-kit');
          AuthKitProvider = authKit.AuthKitProvider;
        } catch (error) {
          console.warn('Farcaster AuthKit not available:', error);
        }

        setAuthComponents({
          SessionProvider,
          AuthKitProvider,
          loaded: true,
        });
      } catch (error) {
        console.error('Error loading auth components:', error);
        setAuthComponents({
          SessionProvider: null,
          AuthKitProvider: null,
          loaded: true,
        });
      }
    };

    loadAuthComponents();
  }, [shouldUseSession]);

  if (!authComponents.loaded) {
    return <></>;
  }

  if (!shouldUseSession || !authComponents.SessionProvider) {
    return <>{children}</>;
  }

  const { SessionProvider, AuthKitProvider } = authComponents;

  if (AuthKitProvider) {
    return (
      <SessionProvider session={session}>
        <AuthKitProvider config={{}}>{children}</AuthKitProvider>
      </SessionProvider>
    );
  }

  return <SessionProvider session={session}>{children}</SessionProvider>;
}

export function Providers({
  session,
  children,
  shouldUseSession = false,
}: {
  session: any | null;
  children: React.ReactNode;
  shouldUseSession?: boolean;
}) {
  const solanaEndpoint =
    process.env.SOLANA_RPC_ENDPOINT || 'https://solana-rpc.publicnode.com';

  return (
    <WagmiProvider>
      <MiniAppProvider
        analyticsEnabled={ANALYTICS_ENABLED}
        backButtonEnabled={true}
      >
        <SafeFarcasterSolanaProvider endpoint={solanaEndpoint}>
          <AuthProviders session={session} shouldUseSession={shouldUseSession}>
            {children}
          </AuthProviders>
        </SafeFarcasterSolanaProvider>
      </MiniAppProvider>
    </WagmiProvider>
  );
}
