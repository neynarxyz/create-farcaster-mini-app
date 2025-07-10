"use client";

import { useCallback, useState } from "react";
import { signIn, signOut, getCsrfToken } from "next-auth/react";
import sdk, { SignIn as SignInCore } from "@farcaster/miniapp-sdk";
import { useSession } from "next-auth/react";
import { Button } from "../Button";

/**
 * SignIn component handles Farcaster authentication using Sign-In with Farcaster (SIWF).
 * 
 * This component provides a complete authentication flow for Farcaster users:
 * - Generates nonces for secure authentication
 * - Handles the SIWF flow using the Farcaster SDK
 * - Manages NextAuth session state
 * - Provides sign-out functionality
 * - Displays authentication status and results
 * 
 * The component integrates with both the Farcaster Frame SDK and NextAuth
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
  const [signInResult, setSignInResult] = useState<SignInCore.SignInResult>();
  const [signInFailure, setSignInFailure] = useState<string>();

  // --- Hooks ---
  const { data: session, status } = useSession();

  // --- Handlers ---
  /**
   * Generates a nonce for the sign-in process.
   * 
   * This function retrieves a CSRF token from NextAuth to use as a nonce
   * for the SIWF authentication flow. The nonce ensures the authentication
   * request is fresh and prevents replay attacks.
   * 
   * @returns Promise<string> - The generated nonce token
   * @throws Error if unable to generate nonce
   */
  const getNonce = useCallback(async () => {
    const nonce = await getCsrfToken();
    if (!nonce) throw new Error("Unable to generate nonce");
    return nonce;
  }, []);

  /**
   * Handles the sign-in process using Farcaster SDK.
   * 
   * This function orchestrates the complete SIWF flow:
   * 1. Generates a nonce for security
   * 2. Calls the Farcaster SDK to initiate sign-in
   * 3. Submits the result to NextAuth for session management
   * 4. Handles various error conditions including user rejection
   * 
   * @returns Promise<void>
   */
  const handleSignIn = useCallback(async () => {
    try {
      setAuthState((prev) => ({ ...prev, signingIn: true }));
      setSignInFailure(undefined);
      const nonce = await getNonce();
      const result = await sdk.actions.signIn({ nonce });
      setSignInResult(result);
      await signIn("credentials", {
        message: result.message,
        signature: result.signature,
        redirect: false,
      });
    } catch (e) {
      if (e instanceof SignInCore.RejectedByUser) {
        setSignInFailure("Rejected by user");
        return;
      }
      setSignInFailure("Unknown error");
    } finally {
      setAuthState((prev) => ({ ...prev, signingIn: false }));
    }
  }, [getNonce]);

  /**
   * Handles the sign-out process.
   * 
   * This function clears the NextAuth session and resets the local
   * sign-in result state to complete the sign-out flow.
   * 
   * @returns Promise<void>
   */
  const handleSignOut = useCallback(async () => {
    try {
      setAuthState((prev) => ({ ...prev, signingOut: true }));
      await signOut({ redirect: false });
      setSignInResult(undefined);
    } finally {
      setAuthState((prev) => ({ ...prev, signingOut: false }));
    }
  }, []);

  // --- Render ---
  return (
    <>
      {/* Authentication Buttons */}
      {status !== "authenticated" && (
        <Button onClick={handleSignIn} disabled={authState.signingIn}>
          Sign In with Farcaster
        </Button>
      )}
      {status === "authenticated" && (
        <Button onClick={handleSignOut} disabled={authState.signingOut}>
          Sign out
        </Button>
      )}

      {/* Session Information */}
      {session && (
        <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-100 dark:bg-gray-900 rounded-lg font-mono">
          <div className="font-semibold text-gray-500 dark:text-gray-300 mb-1">Session</div>
          <div className="whitespace-pre text-gray-700 dark:text-gray-200">
            {JSON.stringify(session, null, 2)}
          </div>
        </div>
      )}

      {/* Error Display */}
      {signInFailure && !authState.signingIn && (
        <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-100 dark:bg-gray-900 rounded-lg font-mono">
          <div className="font-semibold text-gray-500 dark:text-gray-300 mb-1">SIWF Result</div>
          <div className="whitespace-pre text-gray-700 dark:text-gray-200">{signInFailure}</div>
        </div>
      )}

      {/* Success Result Display */}
      {signInResult && !authState.signingIn && (
        <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-100 dark:bg-gray-900 rounded-lg font-mono">
          <div className="font-semibold text-gray-500 dark:text-gray-300 mb-1">SIWF Result</div>
          <div className="whitespace-pre text-gray-700 dark:text-gray-200">
            {JSON.stringify(signInResult, null, 2)}
          </div>
        </div>
      )}
    </>
  );
} 