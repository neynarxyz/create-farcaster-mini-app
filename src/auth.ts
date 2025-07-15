import { sdk } from '@farcaster/miniapp-sdk';

// Export QuickAuth from the SDK
export const quickAuth = sdk.quickAuth;

// Helper function to get session (for server-side compatibility)
export const getSession = async () => {
  // For QuickAuth, sessions are managed by the SDK
  return null;
};
