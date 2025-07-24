import { AuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createAppClient, viemConnector } from '@farcaster/auth-client';

declare module 'next-auth' {
  interface Session {
    provider?: string;
    user?: {
      fid: number;
      object?: 'user';
      username?: string;
      display_name?: string;
      pfp_url?: string;
      custody_address?: string;
      profile?: {
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
      follower_count?: number;
      following_count?: number;
      verifications?: string[];
      verified_addresses?: {
        eth_addresses: string[];
        sol_addresses: string[];
        primary: {
          eth_address: string;
          sol_address: string;
        };
      };
      verified_accounts?: Array<Record<string, unknown>>;
      power_badge?: boolean;
      url?: string;
      experimental?: {
        neynar_user_score: number;
        deprecation_notice: string;
      };
      score?: number;
    };
    signers?: {
      object: 'signer';
      signer_uuid: string;
      public_key: string;
      status: 'approved';
      fid: number;
    }[];
  }

  interface User {
    provider?: string;
    signers?: Array<{
      object: 'signer';
      signer_uuid: string;
      public_key: string;
      status: 'approved';
      fid: number;
    }>;
    user?: {
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
    };
  }

  interface JWT {
    provider?: string;
    signers?: Array<{
      object: 'signer';
      signer_uuid: string;
      public_key: string;
      status: 'approved';
      fid: number;
    }>;
    user?: {
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
      verified_accounts?: Array<Record<string, unknown>>;
      power_badge?: boolean;
      url?: string;
      experimental?: {
        neynar_user_score: number;
        deprecation_notice: string;
      };
      score?: number;
    };
  }
}

function getDomainFromUrl(urlString: string | undefined): string {
  if (!urlString) {
    console.warn('NEXTAUTH_URL is not set, using localhost:3000 as fallback');
    return 'localhost:3000';
  }
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch (error) {
    console.error('Invalid NEXTAUTH_URL:', urlString, error);
    console.warn('Using localhost:3000 as fallback');
    return 'localhost:3000';
  }
}

export const authOptions: AuthOptions = {
  // Configure one or more authentication providers
  providers: [
    CredentialsProvider({
      id: 'neynar',
      name: 'Sign in with Neynar',
      credentials: {
        message: {
          label: 'Message',
          type: 'text',
          placeholder: '0x0',
        },
        signature: {
          label: 'Signature',
          type: 'text',
          placeholder: '0x0',
        },
        nonce: {
          label: 'Nonce',
          type: 'text',
          placeholder: 'Custom nonce (optional)',
        },
        fid: {
          label: 'FID',
          type: 'text',
          placeholder: '0',
        },
        signers: {
          label: 'Signers',
          type: 'text',
          placeholder: 'JSON string of signers',
        },
        user: {
          label: 'User Data',
          type: 'text',
          placeholder: 'JSON string of user data',
        },
      },
      async authorize(credentials) {
        const nonce = credentials?.nonce;

        if (!nonce) {
          console.error('No nonce or CSRF token provided for Neynar auth');
          return null;
        }

        // For Neynar, we can use a different validation approach
        // This could involve validating against Neynar's API or using their SDK
        try {
          // Validate the signature using Farcaster's auth client (same as Farcaster provider)
          const appClient = createAppClient({
            // USE your own RPC URL or else you might get 401 error
            ethereum: viemConnector(),
          });

          const baseUrl =
            process.env.VERCEL_ENV === 'production'
              ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
              : process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT ?? 3000}`;

          const domain = getDomainFromUrl(baseUrl);

          const verifyResponse = await appClient.verifySignInMessage({
            message: credentials?.message as string,
            signature: credentials?.signature as `0x${string}`,
            domain,
            nonce,
          });

          const { success, fid } = verifyResponse;

          if (!success) {
            return null;
          }

          // Validate that the provided FID matches the verified FID
          if (credentials?.fid && parseInt(credentials.fid) !== fid) {
            console.error('FID mismatch in Neynar auth');
            return null;
          }

          return {
            id: fid.toString(),
            provider: 'neynar',
            signers: credentials?.signers
              ? JSON.parse(credentials.signers)
              : undefined,
            user: credentials?.user ? JSON.parse(credentials.user) : undefined,
          };
        } catch (error) {
          console.error('Error in Neynar auth:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    session: async ({ session, token }) => {
      // Set provider at the root level
      session.provider = token.provider as string;

      if (token.provider === 'neynar') {
        // For Neynar, use full user data structure from user
        session.user = token.user as typeof session.user;
        session.signers = token.signers as typeof session.signers;
      }

      return session;
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.provider = user.provider;
        token.signers = user.signers;
        token.user = user.user;
      }
      return token;
    },
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
};

export const getSession = async () => {
  try {
    return await getServerSession(authOptions);
  } catch (error) {
    console.error('Error getting server session:', error);
    return null;
  }
};
