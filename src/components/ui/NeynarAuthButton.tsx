'use client';

import '@farcaster/auth-kit/styles.css';
import { useSignIn } from '@farcaster/auth-kit';
import { useCallback, useEffect, useState, useRef } from 'react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

// Utility functions for device detection
function isAndroid(): boolean {
  return (
    typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
  );
}

function isSmallIOS(): boolean {
  return (
    typeof navigator !== 'undefined' && /iPhone|iPod/.test(navigator.userAgent)
  );
}

function isLargeIOS(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    (/iPad/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
  );
}

function isIOS(): boolean {
  return isSmallIOS() || isLargeIOS();
}

function isMobile(): boolean {
  return isAndroid() || isIOS();
}

// Hook for detecting clicks outside an element
function useDetectClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  callback: () => void
) {
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, callback]);
}

// Storage utilities for persistence
const STORAGE_KEY = 'farcaster_auth_state';

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

function saveAuthState(state: StoredAuthState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save auth state:', error);
  }
}

function loadAuthState(): StoredAuthState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to load auth state:', error);
    return null;
  }
}

function clearAuthState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear auth state:', error);
  }
}

function updateSignersInAuthState(
  signers: StoredAuthState['signers']
): StoredAuthState | null {
  try {
    const stored = loadAuthState();
    if (stored) {
      const updatedState = { ...stored, signers };
      saveAuthState(updatedState);
      return updatedState;
    }
  } catch (error) {
    console.warn('Failed to update signers in auth state:', error);
  }
  return null;
}

export function getStoredSigners(): unknown[] {
  try {
    const stored = loadAuthState();
    return stored?.signers || [];
  } catch (error) {
    console.warn('Failed to get stored signers:', error);
    return [];
  }
}

// Enhanced QR Code Dialog Component with multiple steps
function AuthDialog({
  open,
  onClose,
  url,
  isError,
  error,
  step,
  isLoading,
  signerApprovalUrl,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  isError: boolean;
  error?: Error | null;
  step: 'signin' | 'access' | 'loading';
  isLoading?: boolean;
  signerApprovalUrl?: string | null;
}) {
  if (!open) return null;

  const getStepContent = () => {
    switch (step) {
      case 'signin':
        return {
          title: 'Signin',
          description:
            "To signin, scan the code below with your phone's camera.",
          showQR: true,
          qrUrl: url,
          showOpenButton: true,
        };

      case 'loading':
        return {
          title: 'Setting up access...',
          description:
            'Checking your account permissions and setting up secure access.',
          showQR: false,
          qrUrl: '',
          showOpenButton: false,
        };

      case 'access':
        return {
          title: 'Grant Access',
          description: (
            <div className='space-y-3'>
              <p className='text-gray-600 dark:text-gray-400'>
                Allow this app to access your Farcaster account:
              </p>
              <div className='space-y-2 text-sm'>
                <div className='flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg'>
                  <div className='w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center'>
                    <svg
                      className='w-3 h-3 text-green-600 dark:text-green-400'
                      fill='currentColor'
                      viewBox='0 0 20 20'
                    >
                      <path
                        fillRule='evenodd'
                        d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                        clipRule='evenodd'
                      />
                    </svg>
                  </div>
                  <div>
                    <div className='font-medium text-gray-900 dark:text-gray-100'>
                      Read Access
                    </div>
                    <div className='text-gray-500 dark:text-gray-400'>
                      View your profile and public information
                    </div>
                  </div>
                </div>
                <div className='flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg'>
                  <div className='w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center'>
                    <svg
                      className='w-3 h-3 text-blue-600 dark:text-blue-400'
                      fill='currentColor'
                      viewBox='0 0 20 20'
                    >
                      <path d='M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z' />
                    </svg>
                  </div>
                  <div>
                    <div className='font-medium text-gray-900 dark:text-gray-100'>
                      Write Access
                    </div>
                    <div className='text-gray-500 dark:text-gray-400'>
                      Post casts, likes, and update your profile
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ),
          // Show QR code if we have signer approval URL, otherwise show loading
          showQR: !!signerApprovalUrl,
          qrUrl: signerApprovalUrl || '',
          showOpenButton: !!signerApprovalUrl,
        };

      default:
        return {
          title: 'Sign in',
          description:
            "To signin, scan the code below with your phone's camera.",
          showQR: true,
          qrUrl: url,
          showOpenButton: true,
        };
    }
  };

  const content = getStepContent();

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'>
      <div className='bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md mx-4 shadow-2xl border border-gray-200 dark:border-gray-700'>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
            {isError ? 'Error' : content.title}
          </h2>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
          >
            <svg
              className='w-6 h-6'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>

        {isError ? (
          <div className='text-center'>
            <div className='text-red-600 dark:text-red-400 mb-4'>
              {error?.message || 'Unknown error, please try again.'}
            </div>
            <button onClick={onClose} className='btn btn-primary'>
              Try Again
            </button>
          </div>
        ) : (
          <div className='text-center'>
            <div className='mb-6'>
              {typeof content.description === 'string' ? (
                <p className='text-gray-600 dark:text-gray-400'>
                  {content.description}
                </p>
              ) : (
                content.description
              )}
            </div>

            <div className='mb-6 flex justify-center'>
              {content.showQR && content.qrUrl ? (
                <div className='p-4 bg-white rounded-lg'>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                      content.qrUrl
                    )}`}
                    alt='QR Code'
                    className='w-48 h-48'
                  />
                </div>
              ) : step === 'loading' || isLoading ? (
                <div className='w-48 h-48 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg'>
                  <div className='flex flex-col items-center gap-3'>
                    <div className='spinner w-8 h-8' />
                    <span className='text-sm text-gray-500 dark:text-gray-400'>
                      {step === 'loading'
                        ? 'Setting up access...'
                        : 'Loading...'}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {content.showOpenButton && content.qrUrl && (
              <button
                onClick={() => window.open(content.qrUrl, '_blank')}
                className='btn btn-outline flex items-center justify-center gap-2 w-full'
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  width={12}
                  height={18}
                  fill='none'
                >
                  <path
                    fill='currentColor'
                    d='M11.25 8.25H.75a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5Z'
                  />
                  <path
                    fill='currentColor'
                    d='M9.75 6.75a.75.75 0 0 0-1.5 0v3a.75.75 0 0 0 1.5 0v-3Z'
                  />
                </svg>
                I&apos;m using my phone →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Profile Button Component
function ProfileButton({
  userData,
  onSignOut,
}: {
  userData?: { fid?: number; pfpUrl?: string; username?: string };
  onSignOut: () => void;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useDetectClickOutside(ref, () => setShowDropdown(false));

  const name = userData?.username ?? `!${userData?.fid}`;
  const pfpUrl = userData?.pfpUrl ?? 'https://farcaster.xyz/avatar.png';

  return (
    <div className='relative' ref={ref}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={cn(
          'flex items-center gap-3 px-4 py-2 min-w-0 rounded-lg',
          'bg-transparent border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100',
          'hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
          'focus:outline-none focus:ring-1 focus:ring-primary'
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pfpUrl}
          alt='Profile'
          className='w-6 h-6 rounded-full object-cover flex-shrink-0'
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://farcaster.xyz/avatar.png';
          }}
        />
        <span className='text-sm font-medium truncate max-w-[120px]'>
          {name ? name : '...'}
        </span>
        <svg
          className={cn(
            'w-4 h-4 transition-transform flex-shrink-0',
            showDropdown && 'rotate-180'
          )}
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M19 9l-7 7-7-7'
          />
        </svg>
      </button>

      {showDropdown && (
        <div className='absolute top-full right-0 left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50'>
          <button
            onClick={() => {
              onSignOut();
              setShowDropdown(false);
            }}
            className='w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 rounded-lg transition-colors'
          >
            <svg
              className='w-4 h-4'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={1.5}
                d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'
              />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// Main Custom SignInButton Component
export function NeynarAuthButton() {
  const [nonce, setNonce] = useState<string | null>(null);
  const [storedAuth, setStoredAuth] = useState<StoredAuthState | null>(null);
  const [signersLoading, setSignersLoading] = useState(false);

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
      // console.log('🔧 Creating new signer...');

      const response = await fetch('/api/auth/signer', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to create signer');
      }

      const signerData = await response.json();
      // console.log('✅ Signer created:', signerData);

      return signerData;
    } catch (error) {
      //  console.error('❌ Error creating signer:', error);
      throw error;
    }
  }, []);

  // Helper function to generate signed key request
  const generateSignedKeyRequest = useCallback(
    async (signerUuid: string, publicKey: string) => {
      try {
        // console.log('🔑 Generating signed key request...');

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
        // console.log('✅ Signed key request generated:', data);

        return data;
      } catch (error) {
        console.error('❌ Error generating signed key request:', error);
        throw error;
      }
    },
    []
  );

  // Helper function to fetch all signers
  const fetchAllSigners = useCallback(
    async (message: string, signature: string) => {
      try {
        // console.log('� Fetching all signers...');
        setSignersLoading(true);

        const response = await fetch(
          `/api/auth/signers?message=${encodeURIComponent(
            message
          )}&signature=${signature}`
        );

        const signerData = await response.json();
        // console.log('� Signer response:', signerData);

        if (response.ok) {
          // console.log('✅ Signers fetched successfully:', signerData.signers);

          // Store signers in localStorage
          const updatedState = updateSignersInAuthState(
            signerData.signers || []
          );
          if (updatedState) {
            setStoredAuth(updatedState);
          }

          return signerData.signers;
        } else {
          console.error('❌ Failed to fetch signers');
          throw new Error('Failed to fetch signers');
        }
      } catch (error) {
        console.error('❌ Error fetching signers:', error);
        throw error;
      } finally {
        setSignersLoading(false);
      }
    },
    []
  );

  // Helper function to poll signer status
  const startPolling = useCallback(
    (signerUuid: string, message: string, signature: string) => {
      // console.log('� Starting polling for signer:', signerUuid);

      const interval = setInterval(async () => {
        try {
          const response = await fetch(
            `/api/auth/signer?signerUuid=${signerUuid}`
          );

          if (!response.ok) {
            throw new Error('Failed to poll signer status');
          }

          const signerData = await response.json();
          // console.log('� Signer status:', signerData.status);

          if (signerData.status === 'approved') {
            // console.log('🎉 Signer approved!');
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
    const stored = loadAuthState();
    if (stored && stored.isAuthenticated) {
      setStoredAuth(stored);
      if (stored.signers && stored.signers.length > 0) {
        // console.log('📂 Loaded stored signers:', stored.signers);
      }
    }
  }, []);

  // Success callback - this is critical!
  const onSuccessCallback = useCallback((res: unknown) => {
    // console.log('🎉 Sign in successful!', res);
    const authState: StoredAuthState = {
      isAuthenticated: true,
      userData: res as StoredAuthState['userData'],
      lastSignInTime: Date.now(),
    };
    saveAuthState(authState);
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
    isPolling,
  } = signInState;

  // Connect when component mounts and we have a nonce
  useEffect(() => {
    if (nonce && !channelToken) {
      // console.log('🔌 Connecting with nonce:', nonce);
      connect();
    }
  }, [nonce, channelToken, connect]);

  // Debug logging
  // useEffect(() => {
  //   console.log('🔍 Auth state:', {
  //     isSuccess,
  //     validSignature,
  //     hasData: !!data,
  //     isPolling,
  //     isError,
  //     storedAuth: !!storedAuth?.isAuthenticated,
  //   });
  // }, [isSuccess, validSignature, data, isPolling, isError, storedAuth]);

  // Handle fetching signers after successful authentication
  useEffect(() => {
    if (data?.message && data?.signature) {
      // console.log('📝 Got message and signature:', {
      //   message: data.message,
      //   signature: data.signature,
      // });
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

          // Check if no signers exist
          if (!signers || signers.length === 0) {
            // console.log('� No signers found, creating new signer...');

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
              setDialogStep('access'); // Switch to access step to show QR

              // Step 4: Start polling for signer approval
              startPolling(newSigner.signer_uuid, data.message, data.signature);
            }
          } else {
            // If signers exist, close the dialog
            // console.log('✅ Signers already exist, closing dialog');
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
    // console.log('🚀 Starting sign in flow...');
    if (isError) {
      // console.log('🔄 Reconnecting due to error...');
      reconnect();
    }
    setDialogStep('signin');
    setShowDialog(true);
    signIn();

    // Open mobile app if on mobile and URL is available
    if (url && isMobile()) {
      // console.log('📱 Opening mobile app:', url);
      window.open(url, '_blank');
    }
  }, [isError, reconnect, signIn, url]);

  const handleSignOut = useCallback(() => {
    // console.log('👋 Signing out...');
    setShowDialog(false);
    signOut();
    clearAuthState();
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

      {/* Debug panel (optional - can be removed in production) */}
      {/* {process.env.NODE_ENV === "development" && (
        <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-mono">
          <div className="font-semibold mb-2">Debug Info:</div>
          <pre className="whitespace-pre-wrap text-xs">
            {JSON.stringify(
              {
                authenticated,
                isSuccess,
                validSignature,
                hasData: !!data,
                isPolling,
                isError,
                hasStoredAuth: !!storedAuth?.isAuthenticated,
                hasUrl: !!url,
                hasChannelToken: !!channelToken,
              },
              null,
              2
            )}
          </pre>
        </div>
      )} */}
    </>
  );
}
