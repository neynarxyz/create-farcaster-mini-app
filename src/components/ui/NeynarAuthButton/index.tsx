'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/Button';
import { ProfileButton } from '~/components/ui/NeynarAuthButton/ProfileButton';
import { AuthDialog } from '~/components/ui/NeynarAuthButton/AuthDialog';
import { useMiniApp } from '@neynar/react';
import sdk, { SignIn as SignInCore } from '@farcaster/frame-sdk';
import { useQuickAuth } from '~/hooks/useQuickAuth';

type User = {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  // Add other user properties as needed
};

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
  const {
    authenticatedUser: quickAuthUser,
    signIn: quickAuthSignIn,
    signOut: quickAuthSignOut,
  } = useQuickAuth();

  // New state for unified dialog flow
  const [showDialog, setShowDialog] = useState(false);
  const [dialogStep, setDialogStep] = useState<'signin' | 'access' | 'loading'>(
    'loading',
  );
  const [signerApprovalUrl, setSignerApprovalUrl] = useState<string | null>(
    null,
  );
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSignerFlowRunning, setIsSignerFlowRunning] = useState(false);
  const signerFlowStartedRef = useRef(false);
  const [backendUserProfile, setBackendUserProfile] = useState<{
    username?: string;
    pfpUrl?: string;
  }>({});

  // Determine which flow to use based on context
  const useBackendFlow = context !== undefined;

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

  // Helper function to update session with signers (backend flow only)
  const updateSessionWithSigners = useCallback(
    async (
      signers: StoredAuthState['signers'],
      user: StoredAuthState['user'],
    ) => {
      if (!useBackendFlow) return;

      try {
        // For backend flow, use QuickAuth to sign in
        if (signers && signers.length > 0) {
          await quickAuthSignIn();
        }
      } catch (error) {
        console.error('❌ Error updating session with signers:', error);
      }
    },
    [useBackendFlow, quickAuthSignIn],
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
    [],
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
            `Failed to generate signed key request: ${errorData.error}`,
          );
        }

        const data = await response.json();

        return data;
      } catch (error) {
        console.error('❌ Error generating signed key request:', error);
        // throw error;
      }
    },
    [],
  );

  // Helper function to fetch all signers
  const fetchAllSigners = useCallback(
    async (message: string, signature: string) => {
      try {
        setSignersLoading(true);

        const endpoint = useBackendFlow
          ? `/api/auth/session-signers?message=${encodeURIComponent(
              message,
            )}&signature=${signature}`
          : `/api/auth/signers?message=${encodeURIComponent(
              message,
            )}&signature=${signature}`;

        const response = await fetch(endpoint);
        const signerData = await response.json();

        if (response.ok) {
          if (useBackendFlow) {
            // For backend flow, update session with signers
            if (signerData.signers && signerData.signers.length > 0) {
              // Get user data for the first signer
              let user: StoredAuthState['user'] | null = null;
              if (signerData.signers[0].fid) {
                user = (await fetchUserData(
                  signerData.signers[0].fid,
                )) as StoredAuthState['user'];
              }
              await updateSessionWithSigners(signerData.signers, user);
            }
            return signerData.signers;
          } else {
            // For frontend flow, store in memory only
            let user: StoredAuthState['user'] | null = null;

            if (signerData.signers && signerData.signers.length > 0) {
              const fetchedUser = (await fetchUserData(
                signerData.signers[0].fid,
              )) as StoredAuthState['user'];
              user = fetchedUser;
            }

            // Store signers in memory only
            const updatedState: StoredAuthState = {
              isAuthenticated: !!user,
              signers: signerData.signers || [],
              user,
            };
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
    [useBackendFlow, fetchUserData, updateSessionWithSigners],
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
            `/api/auth/signer?signerUuid=${signerUuid}`,
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
    [fetchAllSigners, pollingInterval],
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

  // Backend flow using QuickAuth
  const handleBackendSignIn = useCallback(async () => {
    if (!nonce) {
      console.error('❌ No nonce available for backend sign-in');
      return;
    }

    try {
      setSignersLoading(true);
      const result = await sdk.actions.signIn({ nonce });

      setMessage(result.message);
      setSignature(result.signature);
      // Use QuickAuth to sign in
      const signInResult = await quickAuthSignIn();
      // Fetch user profile after sign in
      if (quickAuthUser?.fid) {
        const user = await fetchUserData(quickAuthUser.fid);
        setBackendUserProfile({
          username: user?.username || '',
          pfpUrl: user?.pfp_url || '',
        });
      }
    } catch (e) {
      if (e instanceof SignInCore.RejectedByUser) {
        console.log('ℹ️ Sign-in rejected by user');
      } else {
        console.error('❌ Backend sign-in error:', e);
      }
    }
  }, [nonce, quickAuthSignIn, quickAuthUser, fetchUserData]);

  // Fetch user profile when quickAuthUser.fid changes (for backend flow)
  useEffect(() => {
    if (useBackendFlow && quickAuthUser?.fid) {
      (async () => {
        const user = await fetchUserData(quickAuthUser.fid);
        setBackendUserProfile({
          username: user?.username || '',
          pfpUrl: user?.pfp_url || '',
        });
      })();
    }
  }, [useBackendFlow, quickAuthUser?.fid, fetchUserData]);

  const handleFrontEndSignIn = useCallback(async () => {
    try {
      setSignersLoading(true);
      const result = await sdk.actions.signIn({ nonce: nonce || '' });

      setMessage(result.message);
      setSignature(result.signature);

      // For frontend flow, we'll handle the signer flow in the useEffect
    } catch (e) {
      if (e instanceof SignInCore.RejectedByUser) {
        console.log('ℹ️ Sign-in rejected by user');
      } else {
        console.error('❌ Frontend sign-in error:', e);
      }
    } finally {
      setSignersLoading(false);
    }
  }, [nonce]);

  const handleSignOut = useCallback(async () => {
    try {
      setSignersLoading(true);

      if (useBackendFlow) {
        // Use QuickAuth sign out
        await quickAuthSignOut();
      } else {
        // Frontend flow sign out
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
  }, [useBackendFlow, pollingInterval, quickAuthSignOut]);

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

          // Show dialog if not using backend flow or in browser farcaster
          if ((useBackendFlow && !isMobileContext) || !useBackendFlow)
            setShowDialog(true);

          // First, fetch existing signers
          const signers = await fetchAllSigners(message, signature);

          if (useBackendFlow && isMobileContext) setSignersLoading(true);

          // Check if no signers exist or if we have empty signers
          if (!signers || signers.length === 0) {
            // Step 1: Create a signer
            const newSigner = await createSigner();

            // Step 2: Generate signed key request
            const signedKeyData = await generateSignedKeyRequest(
              newSigner.signer_uuid,
              newSigner.public_key,
            );

            // Step 3: Show QR code in access dialog for signer approval
            setSignerApprovalUrl(signedKeyData.signer_approval_url);

            if (isMobileContext) {
              setShowDialog(false);
              await sdk.actions.openUrl(
                signedKeyData.signer_approval_url.replace(
                  'https://client.farcaster.xyz/deeplinks/signed-key-request',
                  'https://farcaster.xyz/~/connect',
                ),
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

  const authenticated = useBackendFlow
    ? !!quickAuthUser?.fid
    : storedAuth?.isAuthenticated &&
      !!(storedAuth?.signers && storedAuth.signers.length > 0);

  const userData = useBackendFlow
    ? {
        fid: quickAuthUser?.fid,
        username: backendUserProfile.username ?? '',
        pfpUrl: backendUserProfile.pfpUrl ?? '',
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
          onClick={useBackendFlow ? handleBackendSignIn : handleFrontEndSignIn}
          disabled={signersLoading}
          className={cn(
            'btn btn-primary flex items-center gap-3',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transform transition-all duration-200 active:scale-[0.98]',
          )}
        >
          {signersLoading ? (
            <>
              <div className="spinner-primary w-5 h-5" />
              <span>Loading...</span>
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
          url={undefined}
          isError={false}
          error={null}
          step={dialogStep}
          isLoading={signersLoading}
          signerApprovalUrl={signerApprovalUrl}
        />
      }
    </>
  );
}
