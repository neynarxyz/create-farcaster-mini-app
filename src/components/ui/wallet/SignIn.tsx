'use client';

import { useCallback, useState } from 'react';
import { SignIn as SignInCore } from '@farcaster/miniapp-sdk';
import { useQuickAuth } from '~/hooks/useQuickAuth';
import { Button } from '../Button';

/**
 * SignIn component handles Farcaster authentication using QuickAuth.
 *
 * This component provides a complete authentication flow for Farcaster users:
 * - Uses the built-in QuickAuth functionality from the Farcaster SDK
 * - Manages authentication state in memory (no persistence)
 * - Provides sign-out functionality
 * - Displays authentication status and results
 *
 * The component integrates with the Farcaster Frame SDK and QuickAuth
 * to provide seamless authentication within mini apps.
 *
 * @example
 * ```tsx
 * <SignIn />
 * ```
 */

interface AuthState {
  signingIn: boolean;
  signingOut: boolean;
}

export function SignIn() {
  // --- State ---
  const [authState, setAuthState] = useState<AuthState>({
    signingIn: false,
    signingOut: false,
  });
  const [signInFailure, setSignInFailure] = useState<string>();

  // --- Hooks ---
  const { authenticatedUser, status, signIn, signOut } = useQuickAuth();

  // --- Handlers ---
  /**
   * Handles the sign-in process using QuickAuth.
   *
   * This function uses the built-in QuickAuth functionality:
   * 1. Gets a token from QuickAuth (handles SIWF flow automatically)
   * 2. Validates the token with our server
   * 3. Updates the session state
   *
   * @returns Promise<void>
   */
  const handleSignIn = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, signingIn: true }));
      setSignInFailure(undefined);

      const success = await signIn();

      if (!success) {
        setSignInFailure('Authentication failed');
      }
    } catch (e) {
      if (e instanceof SignInCore.RejectedByUser) {
        setSignInFailure('Rejected by user');
        return;
      }
      setSignInFailure('Unknown error');
    } finally {
      setAuthState(prev => ({ ...prev, signingIn: false }));
    }
  }, [signIn]);

  /**
   * Handles the sign-out process.
   *
   * This function clears the QuickAuth session and resets the local state.
   *
   * @returns Promise<void>
   */
  const handleSignOut = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, signingOut: true }));
      await signOut();
    } finally {
      setAuthState(prev => ({ ...prev, signingOut: false }));
    }
  }, [signOut]);

  // --- Render ---
  return (
    <>
      {/* Authentication Buttons */}
      {status !== 'authenticated' && (
        <Button onClick={handleSignIn} disabled={authState.signingIn}>
          Sign In with Farcaster
        </Button>
      )}
      {status === 'authenticated' && (
        <Button onClick={handleSignOut} disabled={authState.signingOut}>
          Sign out
        </Button>
      )}

      {/* Session Information */}
      {authenticatedUser && (
        <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-100 dark:bg-gray-900 rounded-lg font-mono">
          <div className="font-semibold text-gray-500 dark:text-gray-300 mb-1">
            Authenticated User
          </div>
          <div className="whitespace-pre text-gray-700 dark:text-gray-200">
            {JSON.stringify(authenticatedUser, null, 2)}
          </div>
        </div>
      )}

      {/* Error Display */}
      {signInFailure && !authState.signingIn && (
        <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-100 dark:bg-gray-900 rounded-lg font-mono">
          <div className="font-semibold text-gray-500 dark:text-gray-300 mb-1">
            Authentication Error
          </div>
          <div className="whitespace-pre text-gray-700 dark:text-gray-200">
            {signInFailure}
          </div>
        </div>
      )}
    </>
  );
}