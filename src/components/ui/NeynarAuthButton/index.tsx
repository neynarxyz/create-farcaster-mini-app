'use client';

import '@farcaster/auth-kit/styles.css';
import { useSignIn } from '@farcaster/auth-kit';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/Button';
import { isMobile } from '~/lib/devices';
import { ProfileButton } from '~/components/ui/NeynarAuthButton/ProfileButton';
import { AuthDialog } from '~/components/ui/NeynarAuthButton/AuthDialog';
import { getItem, removeItem, setItem } from '~/lib/localStorage';
import { useMiniApp } from '@neynar/react';

const STORAGE_KEY = 'neynar_authenticated_user';
const FARCASTER_FID = 9152;

interface StoredAuthState {
  isAuthenticated: boolean;
  userData?: {
    fid?: number;
    pfpUrl?: string;
    username?: string;
  };
  lastSignInTime?: number;
  signers?: {
    object: 'signer';
    signer_uuid: string;
    public_key: string;
    status: 'approved';
    fid: number;
  }[]; // Store the list of signers
}

// Main Custom SignInButton Component
export function NeynarAuthButton() {
  const [nonce, setNonce] = useState<string | null>(null);
  const [storedAuth, setStoredAuth] = useState<StoredAuthState | null>(null);
  const [signersLoading, setSignersLoading] = useState(false);
  const { context } = useMiniApp();
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

        const response = await fetch(
          `/api/auth/signers?message=${encodeURIComponent(
            message
          )}&signature=${signature}`
        );

        const signerData = await response.json();

        if (response.ok) {
          // Store signers in localStorage, preserving existing auth data
          const existingAuth = getItem<StoredAuthState>(STORAGE_KEY);
          const updatedState: StoredAuthState = {
            ...existingAuth,
            isAuthenticated: true,
            signers: signerData.signers || [],
            lastSignInTime: existingAuth?.lastSignInTime || Date.now(),
          };
          setItem<StoredAuthState>(STORAGE_KEY, updatedState);
          setStoredAuth(updatedState);

          return signerData.signers;
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
    []
  );

  // Helper function to poll signer status
  const startPolling = useCallback(
    (signerUuid: string, message: string, signature: string) => {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(
            `/api/auth/signer?signerUuid=${signerUuid}`
          );

          if (!response.ok) {
            throw new Error('Failed to poll signer status');
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
      }, 1000); // Poll every 1 second

      setPollingInterval(interval);
    },
    [fetchAllSigners]
  );

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
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

  // Load stored auth state on mount
  useEffect(() => {
    const stored = getItem<StoredAuthState>(STORAGE_KEY);
    if (stored && stored.isAuthenticated) {
      setStoredAuth(stored);
    }
  }, []);

  // Success callback - this is critical!
  const onSuccessCallback = useCallback((res: unknown) => {
    const existingAuth = getItem<StoredAuthState>(STORAGE_KEY);
    const authState: StoredAuthState = {
      isAuthenticated: true,
      userData: res as StoredAuthState['userData'],
      lastSignInTime: Date.now(),
      signers: existingAuth?.signers || [], // Preserve existing signers
    };
    setItem<StoredAuthState>(STORAGE_KEY, authState);
    setStoredAuth(authState);
    // setShowDialog(false);
  }, []);

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
    signIn,
    signOut,
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

  // Connect when component mounts and we have a nonce
  useEffect(() => {
    if (nonce && !channelToken) {
      connect();
    }
  }, [nonce, channelToken, connect]);

  // Handle fetching signers after successful authentication
  useEffect(() => {
    if (data?.message && data?.signature) {
      const handleSignerFlow = async () => {
        try {
          // Ensure we have message and signature
          if (!data.message || !data.signature) {
            console.error('❌ Missing message or signature');
            return;
          }

          // Step 1: Change to loading state
          setDialogStep('loading');
          setSignersLoading(true);

          // First, fetch existing signers
          const signers = await fetchAllSigners(data.message, data.signature);

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
            if (signedKeyData.signer_approval_url) {
              setSignerApprovalUrl(signedKeyData.signer_approval_url);
              setSignersLoading(false); // Stop loading, show QR code
              if (context?.client?.clientFid === FARCASTER_FID) {
                setShowDialog(false);
                window.open(signedKeyData.signer_approval_url, '_blank');
              } else {
                setDialogStep('access'); // Switch to access step to show QR
              }

              // Step 4: Start polling for signer approval
              startPolling(newSigner.signer_uuid, data.message, data.signature);
            }
          } else {
            // If signers exist, close the dialog
            setSignersLoading(false);
            setShowDialog(false);
            setDialogStep('signin');
          }
        } catch (error) {
          console.error('❌ Error in signer flow:', error);
          // On error, reset to signin step
          setDialogStep('signin');
          setSignersLoading(false);
        }
      };

      handleSignerFlow();
    }
  }, [
    data?.message,
    data?.signature,
    fetchAllSigners,
    createSigner,
    generateSignedKeyRequest,
    startPolling,
  ]);

  const handleSignIn = useCallback(() => {
    if (isError) {
      reconnect();
    }
    setDialogStep('signin');
    setShowDialog(true);
    signIn();

    // Open mobile app if on mobile and URL is available
    if (url && isMobile()) {
      window.open(url, '_blank');
    }
  }, [isError, reconnect, signIn, url]);

  const handleSignOut = useCallback(() => {
    setShowDialog(false);
    signOut();
    removeItem(STORAGE_KEY);
    setStoredAuth(null);
  }, [signOut]);

  // The key fix: match the original library's authentication logic exactly
  const authenticated =
    ((isSuccess && validSignature) || storedAuth?.isAuthenticated) &&
    !!(storedAuth?.signers && storedAuth.signers.length > 0);
  const userData = data || storedAuth?.userData;

  // Show loading state while nonce is being fetched or signers are loading
  if (!nonce || signersLoading) {
    return (
      <div className='flex items-center justify-center'>
        <div className='flex items-center gap-3 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg'>
          <div className='spinner w-4 h-4' />
          <span className='text-sm text-gray-600 dark:text-gray-400'>
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
          onClick={handleSignIn}
          disabled={!url}
          className={cn(
            'btn btn-primary flex items-center gap-3',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transform transition-all duration-200 active:scale-[0.98]',
            !url && 'cursor-not-allowed'
          )}
        >
          {!url ? (
            <>
              <div className='spinner-primary w-5 h-5' />
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
      {url && (
        <AuthDialog
          open={showDialog && !isMobile()}
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
      )}
    </>
  );
}
