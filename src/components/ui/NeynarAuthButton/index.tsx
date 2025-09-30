'use client';

/**
 * This authentication system is designed to work both in a regular web browser and inside a miniapp.
 * In other words, it supports authentication when the miniapp context is not present (web browser) as well as when the app is running inside the miniapp.
 * If you only need authentication for a web application, follow the Webapp flow;
 * if you only need authentication inside a miniapp, follow the Miniapp flow.
 */

import '@farcaster/auth-kit/styles.css';
import { useSignIn, UseSignInData } from '@farcaster/auth-kit';
import { useCallback, useEffect, useState, useRef } from 'react';
import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/Button';
import { ProfileButton } from '~/components/ui/NeynarAuthButton/ProfileButton';
import { AuthDialog } from '~/components/ui/NeynarAuthButton/AuthDialog';
import { getItem, removeItem, setItem } from '~/lib/localStorage';
import { useMiniApp } from '@neynar/react';
import {
  signIn as miniappSignIn,
  signOut as miniappSignOut,
  useSession,
} from 'next-auth/react';
import sdk, { SignIn as SignInCore } from '@farcaster/miniapp-sdk';

type User = {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  // Add other user properties as needed
};

const STORAGE_KEY = 'neynar_authenticated_user';
const FARCASTER_FID = 9152;

interface StoredAuthState {
  isAuthenticated: boolean;
  user: {
    object: 'user';
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
    custody_address: string;
    profile: {
      bio: {
        text: string;
        mentioned_profiles?: Array<{
          object: 'user_dehydrated';
          fid: number;
          username: string;
          display_name: string;
          pfp_url: string;
          custody_address: string;
        }>;
        mentioned_profiles_ranges?: Array<{
          start: number;
          end: number;
        }>;
      };
      location?: {
        latitude: number;
        longitude: number;
        address: {
          city: string;
          state: string;
          country: string;
          country_code: string;
        };
      };
    };
    follower_count: number;
    following_count: number;
    verifications: string[];
    verified_addresses: {
      eth_addresses: string[];
      sol_addresses: string[];
      primary: {
        eth_address: string;
        sol_address: string;
      };
    };
    verified_accounts: Array<Record<string, unknown>>;
    power_badge: boolean;
    url?: string;
    experimental?: {
      neynar_user_score: number;
      deprecation_notice: string;
    };
    score: number;
  } | null;
  signers: {
    object: 'signer';
    signer_uuid: string;
    public_key: string;
    status: 'approved';
    fid: number;
  }[];
}

// Main Custom SignInButton Component
export function NeynarAuthButton() {
  const [nonce, setNonce] = useState<string | null>(null);
  const [storedAuth, setStoredAuth] = useState<StoredAuthState | null>(null);
  const [signersLoading, setSignersLoading] = useState(false);
  const { context } = useMiniApp();
  const { data: session } = useSession();
  // New state for unified dialog flow
  const [showDialog, setShowDialog] = useState(false);
  const [dialogStep, setDialogStep] = useState<'signin' | 'access' | 'loading'>(
    'loading'
  );
  const [signerApprovalUrl, setSignerApprovalUrl] = useState<string | null>(
    null
  );
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null
  );
  const [message, setMessage] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSignerFlowRunning, setIsSignerFlowRunning] = useState(false);
  const signerFlowStartedRef = useRef(false);

  // Determine which flow to use based on context
  const useMiniappFlow = context !== undefined;

  // Helper function to create a signer
  const createSigner = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/signer', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to create signer');
      }

      const signerData = await response.json();
      return signerData;
    } catch (error) {
      console.error('❌ Error creating signer:', error);
      // throw error;
    }
  }, []);

  // Helper function to update session with signers (miniapp flow only)
  const updateSessionWithSigners = useCallback(
    async (
      signers: StoredAuthState['signers'],
      user: StoredAuthState['user']
    ) => {
      if (!useMiniappFlow) return;

      try {
        // For miniapp flow, we need to sign in again with the additional data
        if (message && signature) {
          const signInData = {
            message,
            signature,
            redirect: false,
            nonce: nonce || '',
            fid: user?.fid?.toString() || '',
            signers: JSON.stringify(signers),
            user: JSON.stringify(user),
          };

          await miniappSignIn('neynar', signInData);
        }
      } catch (error) {
        console.error('❌ Error updating session with signers:', error);
      }
    },
    [useMiniappFlow, message, signature, nonce]
  );

  // Helper function to fetch user data from Neynar API
  const fetchUserData = useCallback(
    async (fid: number): Promise<User | null> => {
      try {
        const response = await fetch(`/api/users?fids=${fid}`);
        if (response.ok) {
          const data = await response.json();
          return data.users?.[0] || null;
        }
        return null;
      } catch (error) {
        console.error('Error fetching user data:', error);
        return null;
      }
    },
    []
  );

  // Helper function to generate signed key request
  const generateSignedKeyRequest = useCallback(
    async (signerUuid: string, publicKey: string) => {
      try {
        // Prepare request body
        const requestBody: {
          signerUuid: string;
          publicKey: string;
          sponsor?: { sponsored_by_neynar: boolean };
        } = {
          signerUuid,
          publicKey,
        };

        const response = await fetch('/api/auth/signer/signed_key', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            `Failed to generate signed key request: ${errorData.error}`
          );
        }

        const data = await response.json();

        return data;
      } catch (error) {
        console.error('❌ Error generating signed key request:', error);
        // throw error;
      }
    },
    []
  );

  // Helper function to fetch all signers
  const fetchAllSigners = useCallback(
    async (message: string, signature: string) => {
      try {
        setSignersLoading(true);

        const endpoint = useMiniappFlow
          ? `/api/auth/session-signers?message=${encodeURIComponent(
              message
            )}&signature=${signature}`
          : `/api/auth/signers?message=${encodeURIComponent(
              message
            )}&signature=${signature}`;

        const response = await fetch(endpoint);
        const signerData = await response.json();

        if (response.ok) {
          if (useMiniappFlow) {
            // For miniapp flow, update session with signers
            if (signerData.signers && signerData.signers.length > 0) {
              const user =
                signerData.user ||
                (await fetchUserData(signerData.signers[0].fid));
              await updateSessionWithSigners(signerData.signers, user);
            }
            return signerData.signers;
          } else {
            // For webapp flow, store in localStorage
            let user: StoredAuthState['user'] | null = null;

            if (signerData.signers && signerData.signers.length > 0) {
              const fetchedUser = (await fetchUserData(
                signerData.signers[0].fid
              )) as StoredAuthState['user'];
              user = fetchedUser;
            }

            // Store signers in localStorage, preserving existing auth data
            const updatedState: StoredAuthState = {
              isAuthenticated: !!user,
              signers: signerData.signers || [],
              user,
            };
            setItem<StoredAuthState>(STORAGE_KEY, updatedState);
            setStoredAuth(updatedState);

            return signerData.signers;
          }
        } else {
          console.error('❌ Failed to fetch signers');
          // throw new Error('Failed to fetch signers');
        }
      } catch (error) {
        console.error('❌ Error fetching signers:', error);
        // throw error;
      } finally {
        setSignersLoading(false);
      }
    },
    [useMiniappFlow, fetchUserData, updateSessionWithSigners]
  );

  // Helper function to poll signer status
  const startPolling = useCallback(
    (signerUuid: string, message: string, signature: string) => {
      // Clear any existing polling interval before starting a new one
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }

      let retryCount = 0;
      const maxRetries = 10; // Maximum 10 retries (20 seconds total)
      const maxPollingTime = 60000; // Maximum 60 seconds of polling
      const startTime = Date.now();

      const interval = setInterval(async () => {
        // Check if we've been polling too long
        if (Date.now() - startTime > maxPollingTime) {
          clearInterval(interval);
          setPollingInterval(null);
          return;
        }

        try {
          const response = await fetch(
            `/api/auth/signer?signerUuid=${signerUuid}`
          );

          if (!response.ok) {
            // Check if it's a rate limit error
            if (response.status === 429) {
              clearInterval(interval);
              setPollingInterval(null);
              return;
            }

            // Increment retry count for other errors
            retryCount++;
            if (retryCount >= maxRetries) {
              clearInterval(interval);
              setPollingInterval(null);
              return;
            }

            throw new Error(`Failed to poll signer status: ${response.status}`);
          }

          const signerData = await response.json();

          if (signerData.status === 'approved') {
            clearInterval(interval);
            setPollingInterval(null);
            setShowDialog(false);
            setDialogStep('signin');
            setSignerApprovalUrl(null);

            // Refetch all signers
            await fetchAllSigners(message, signature);
          }
        } catch (error) {
          console.error('❌ Error polling signer:', error);
        }
      }, 2000); // Poll every 2 second

      setPollingInterval(interval);
    },
    [fetchAllSigners, pollingInterval]
  );

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      signerFlowStartedRef.current = false;
    };
  }, [pollingInterval]);

  // Generate nonce
  useEffect(() => {
    const generateNonce = async () => {
      try {
        const response = await fetch('/api/auth/nonce');
        if (response.ok) {
          const data = await response.json();
          setNonce(data.nonce);
        } else {
          console.error('Failed to fetch nonce');
        }
      } catch (error) {
        console.error('Error generating nonce:', error);
      }
    };

    generateNonce();
  }, []);

  // Load stored auth state on mount (only for webapp flow)
  useEffect(() => {
    if (!useMiniappFlow) {
      const stored = getItem<StoredAuthState>(STORAGE_KEY);
      if (stored && stored.isAuthenticated) {
        setStoredAuth(stored);
      }
    }
  }, [useMiniappFlow]);

  // Success callback - this is critical!
  const onSuccessCallback = useCallback(
    async (res: UseSignInData) => {
      if (!useMiniappFlow) {
        // Only handle localStorage for webapp flow
        const existingAuth = getItem<StoredAuthState>(STORAGE_KEY);
        const user = res.fid ? await fetchUserData(res.fid) : null;
        const authState: StoredAuthState = {
          ...existingAuth,
          isAuthenticated: true,
          user: user as StoredAuthState['user'],
          signers: existingAuth?.signers || [], // Preserve existing signers
        };
        setItem<StoredAuthState>(STORAGE_KEY, authState);
        setStoredAuth(authState);
      }
      // For miniapp flow, the session will be handled by NextAuth
    },
    [useMiniappFlow, fetchUserData]
  );

  // Error callback
  const onErrorCallback = useCallback((error?: Error | null) => {
    console.error('❌ Sign in error:', error);
  }, []);

  const signInState = useSignIn({
    nonce: nonce || undefined,
    onSuccess: onSuccessCallback,
    onError: onErrorCallback,
  });

  const {
    signIn: webappSignIn,
    signOut: webappSignOut,
    connect,
    reconnect,
    isSuccess,
    isError,
    error,
    channelToken,
    url,
    data,
    validSignature,
  } = signInState;

  useEffect(() => {
    setMessage(data?.message || null);
    setSignature(data?.signature || null);

    // Reset the signer flow flag when message/signature change
    if (data?.message && data?.signature) {
      signerFlowStartedRef.current = false;
    }
  }, [data?.message, data?.signature]);

  // Connect for webapp flow when nonce is available
  useEffect(() => {
    if (!useMiniappFlow && nonce && !channelToken) {
      connect();
    }
  }, [useMiniappFlow, nonce, channelToken, connect]);

  // Handle fetching signers after successful authentication
  useEffect(() => {
    if (
      message &&
      signature &&
      !isSignerFlowRunning &&
      !signerFlowStartedRef.current
    ) {
      signerFlowStartedRef.current = true;

      const handleSignerFlow = async () => {
        setIsSignerFlowRunning(true);
        try {
          const clientContext = context?.client as Record<string, unknown>;
          const isMobileContext =
            clientContext?.platformType === 'mobile' &&
            clientContext?.clientFid === FARCASTER_FID;

          // Step 1: Change to loading state
          setDialogStep('loading');

          // Show dialog if not using miniapp flow or in browser farcaster
          if ((useMiniappFlow && !isMobileContext) || !useMiniappFlow)
            setShowDialog(true);

          // First, fetch existing signers
          const signers = await fetchAllSigners(message, signature);

          if (useMiniappFlow && isMobileContext) setSignersLoading(true);

          // Check if no signers exist or if we have empty signers
          if (!signers || signers.length === 0) {
            // Step 1: Create a signer
            const newSigner = await createSigner();

            // Step 2: Generate signed key request
            const signedKeyData = await generateSignedKeyRequest(
              newSigner.signer_uuid,
              newSigner.public_key
            );

            // Step 3: Show QR code in access dialog for signer approval
            setSignerApprovalUrl(signedKeyData.signer_approval_url);

            if (isMobileContext) {
              setShowDialog(false);
              await sdk.actions.openUrl(
                signedKeyData.signer_approval_url.replace(
                  'https://client.farcaster.xyz/deeplinks/signed-key-request',
                  'https://farcaster.xyz/~/connect'
                )
              );
            } else {
              setShowDialog(true); // Ensure dialog is shown during loading
              setDialogStep('access');
            }

            // Step 4: Start polling for signer approval
            startPolling(newSigner.signer_uuid, message, signature);
          } else {
            // If signers exist, close the dialog
            setSignersLoading(false);
            setShowDialog(false);
            setDialogStep('signin');
          }
        } catch (error) {
          console.error('❌ Error in signer flow:', error);
          // On error, reset to signin step and hide dialog
          setDialogStep('signin');
          setSignersLoading(false);
          setShowDialog(false);
          setSignerApprovalUrl(null);
        } finally {
          setIsSignerFlowRunning(false);
        }
      };

      handleSignerFlow();
    }
  }, [message, signature]); // Simplified dependencies

  // Miniapp flow using NextAuth
  const handleMiniappSignIn = useCallback(async () => {
    if (!nonce) {
      console.error('❌ No nonce available for miniapp sign-in');
      return;
    }

    try {
      setSignersLoading(true);
      const result = await sdk.actions.signIn({ nonce });

      const signInData = {
        message: result.message,
        signature: result.signature,
        redirect: false,
        nonce: nonce,
      };

      const nextAuthResult = await miniappSignIn('neynar', signInData);
      if (nextAuthResult?.ok) {
        setMessage(result.message);
        setSignature(result.signature);
      } else {
        console.error('❌ NextAuth sign-in failed:', nextAuthResult);
      }
    } catch (e) {
      if (e instanceof SignInCore.RejectedByUser) {
        console.log('ℹ️ Sign-in rejected by user');
      } else {
        console.error('❌ Miniapp sign-in error:', e);
      }
    } finally {
      setSignersLoading(false);
    }
  }, [nonce]);

  const handleWebappSignIn = useCallback(() => {
    if (isError) {
      reconnect();
    }
    setDialogStep('signin');
    setShowDialog(true);
    webappSignIn();
  }, [isError, reconnect, webappSignIn]);

  const handleSignOut = useCallback(async () => {
    try {
      setSignersLoading(true);

      if (useMiniappFlow) {
        // Only sign out from NextAuth if the current session is from Neynar provider
        if (session?.provider === 'neynar') {
          await miniappSignOut({ redirect: false });
        }
      } else {
        // Webapp flow sign out
        webappSignOut();
        removeItem(STORAGE_KEY);
        setStoredAuth(null);
      }

      // Common cleanup for both flows
      setShowDialog(false);
      setDialogStep('signin');
      setSignerApprovalUrl(null);
      setMessage(null);
      setSignature(null);

      // Reset polling interval
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }

      // Reset signer flow flag
      signerFlowStartedRef.current = false;
    } catch (error) {
      console.error('❌ Error during sign out:', error);
      // Optionally handle error state
    } finally {
      setSignersLoading(false);
    }
  }, [useMiniappFlow, webappSignOut, pollingInterval, session]);

  const authenticated = useMiniappFlow
    ? !!(
        session?.provider === 'neynar' &&
        session?.user?.fid &&
        session?.signers &&
        session.signers.length > 0
      )
    : ((isSuccess && validSignature) || storedAuth?.isAuthenticated) &&
      !!(storedAuth?.signers && storedAuth.signers.length > 0);

  const userData = useMiniappFlow
    ? {
        fid: session?.user?.fid,
        username: session?.user?.username || '',
        pfpUrl: session?.user?.pfp_url || '',
      }
    : {
        fid: storedAuth?.user?.fid,
        username: storedAuth?.user?.username || '',
        pfpUrl: storedAuth?.user?.pfp_url || '',
      };

  // Show loading state while nonce is being fetched or signers are loading
  if (!nonce || signersLoading) {
    return (
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="spinner w-4 h-4" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      {authenticated ? (
        <ProfileButton userData={userData} onSignOut={handleSignOut} />
      ) : (
        <Button
          onClick={useMiniappFlow ? handleMiniappSignIn : handleWebappSignIn}
          disabled={!useMiniappFlow && !url}
          className={cn(
            'btn btn-primary flex items-center gap-3',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transform transition-all duration-200 active:scale-[0.98]',
            !url && !useMiniappFlow && 'cursor-not-allowed'
          )}
        >
          {!useMiniappFlow && !url ? (
            <>
              <div className="spinner-primary w-5 h-5" />
              <span>Initializing...</span>
            </>
          ) : (
            <>
              <span>Sign in with Neynar</span>
            </>
          )}
        </Button>
      )}

      {/* Unified Auth Dialog */}
      {
        <AuthDialog
          open={showDialog}
          onClose={() => {
            setShowDialog(false);
            setDialogStep('signin');
            setSignerApprovalUrl(null);
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
          }}
          url={url}
          isError={isError}
          error={error}
          step={dialogStep}
          isLoading={signersLoading}
          signerApprovalUrl={signerApprovalUrl}
        />
      }
    </>
  );
}
