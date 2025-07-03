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

// QR Code Dialog Component
function QRCodeDialog({
  open,
  onClose,
  url,
  isError,
  error,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  isError: boolean;
  error?: Error | null;
}) {
  if (!open) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'>
      <div className='bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm mx-4 shadow-2xl border border-gray-200 dark:border-gray-700'>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
            {isError ? 'Error' : 'Sign in with Farcaster'}
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
            <p className='text-gray-600 dark:text-gray-400 mb-6'>
              To sign in with Farcaster, scan the code below with your
              phone&apos;s camera.
            </p>

            <div className='mb-6 flex justify-center'>
              <div className='p-4 bg-white rounded-lg'>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    url
                  )}`}
                  alt='QR Code for Farcaster sign in'
                  className='w-48 h-48'
                />
              </div>
            </div>

            <button
              onClick={() => window.open(url, '_blank')}
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
                  fillRule='evenodd'
                  d='M0 3a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V3Zm4-1.5v.75c0 .414.336.75.75.75h2.5A.75.75 0 0 0 8 2.25V1.5h1A1.5 1.5 0 0 1 10.5 3v12A1.5 1.5 0 0 1 9 16.5H3A1.5 1.5 0 0 1 1.5 15V3A1.5 1.5 0 0 1 3 1.5h1Z'
                  clipRule='evenodd'
                />
              </svg>
              I&apos;m using my phone →
            </button>
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
  const [showDialog, setShowDialog] = useState(false);
  const [storedAuth, setStoredAuth] = useState<StoredAuthState | null>(null);

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
    }
  }, []);

  // Success callback - this is critical!
  const onSuccessCallback = useCallback((res: unknown) => {
    console.log('🎉 Sign in successful!', res);
    const authState: StoredAuthState = {
      isAuthenticated: true,
      userData: res as StoredAuthState['userData'],
      lastSignInTime: Date.now(),
    };
    saveAuthState(authState);
    setStoredAuth(authState);
    setShowDialog(false);
  }, []);

  // Status response callback
  const onStatusCallback = useCallback((statusData: unknown) => {
    console.log('📊 Status response:', statusData);
  }, []);

  // Error callback
  const onErrorCallback = useCallback((error?: Error | null) => {
    console.error('❌ Sign in error:', error);
  }, []);

  const signInState = useSignIn({
    nonce: nonce || undefined,
    onSuccess: onSuccessCallback,
    onStatusResponse: onStatusCallback,
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
      console.log('🔌 Connecting with nonce:', nonce);
      connect();
    }
  }, [nonce, channelToken, connect]);

  // Debug logging
  useEffect(() => {
    console.log('🔍 Auth state:', {
      isSuccess,
      validSignature,
      hasData: !!data,
      isPolling,
      isError,
      storedAuth: !!storedAuth?.isAuthenticated,
    });
  }, [isSuccess, validSignature, data, isPolling, isError, storedAuth]);

  // Handle fetching signers after successful authentication
  useEffect(() => {
    if (data?.message && data?.signature) {
      console.log('📝 Got message and signature:', {
        message: data.message,
        signature: data.signature,
      });

      const fetchSigners = async () => {
        try {
          const response = await fetch(
            `/api/auth/signer?message=${encodeURIComponent(
              data.message || ''
            )}&signature=${data.signature}`
          );

          const signerData = await response.json();
          console.log('🔐 Signer response:', signerData);

          if (response.ok) {
            console.log('✅ Signers fetched successfully:', signerData.signers);
          } else {
            console.error('❌ Failed to fetch signers');
          }
        } catch (error) {
          console.error('❌ Error fetching signers:', error);
        }
      };

      fetchSigners();
    }
  }, [data?.message, data?.signature]);

  const handleSignIn = useCallback(() => {
    console.log('🚀 Starting sign in flow...');
    if (isError) {
      console.log('🔄 Reconnecting due to error...');
      reconnect();
    }
    setShowDialog(true);
    signIn();

    // Open mobile app if on mobile and URL is available
    if (url && isMobile()) {
      console.log('📱 Opening mobile app:', url);
      window.open(url, '_blank');
    }
  }, [isError, reconnect, signIn, url]);

  const handleSignOut = useCallback(() => {
    console.log('👋 Signing out...');
    setShowDialog(false);
    signOut();
    clearAuthState();
    setStoredAuth(null);
  }, [signOut]);

  // The key fix: match the original library's authentication logic exactly
  const authenticated =
    (isSuccess && validSignature) || storedAuth?.isAuthenticated;
  const userData = data || storedAuth?.userData;

  // Show loading state while nonce is being fetched
  if (!nonce) {
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
            'transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]',
            !url && 'cursor-not-allowed'
          )}
        >
          {!url ? (
            <>
              <div className='spinner-primary w-5 h-5' />
              <span>Initializing...</span>
            </>
          ) : (
            /* The above code is a conditional rendering block in a TypeScript React component. It checks
          if the environment variable `NODE_ENV` is set to "development", and if so, it renders a
          debug info section displaying various boolean values related to the application state.
          This debug info includes values such as `authenticated`, `isSuccess`, `validSignature`,
          `hasData`, `isPolling`, `isError`, `hasStoredAuth`, `hasUrl`, and `hasChannelToken`. These
          values are displayed in a formatted JSON string within a `<pre>` element for easy
          readability during development. */
            <>
              <span>Sign in with Neynar</span>
            </>
          )}
        </Button>
      )}

      {/* QR Code Dialog for desktop */}
      {url && (
        <QRCodeDialog
          open={showDialog && !isMobile()}
          onClose={() => setShowDialog(false)}
          url={url}
          isError={isError}
          error={error}
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
