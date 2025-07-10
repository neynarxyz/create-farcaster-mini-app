import { AuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createAppClient, viemConnector } from '@farcaster/auth-client';

declare module 'next-auth' {
  interface Session {
    user: {
      fid: number;
      provider?: string;
      username?: string;
    };
  }

  interface User {
    provider?: string;
    username?: string;
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
      id: 'farcaster',
      name: 'Sign in with Farcaster',
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
        // In a production app with a server, these should be fetched from
        // your Farcaster data indexer rather than have them accepted as part
        // of credentials.
        // question: should these natively use the Neynar API?
        name: {
          label: 'Name',
          type: 'text',
          placeholder: '0x0',
        },
        pfp: {
          label: 'Pfp',
          type: 'text',
          placeholder: '0x0',
        },
      },
      async authorize(credentials, req) {
        const nonce = req?.body?.csrfToken;

        if (!nonce) {
          console.error('No nonce or CSRF token provided');
          return null;
        }
        const appClient = createAppClient({
          ethereum: viemConnector(),
        });

        const domain = getDomainFromUrl(process.env.NEXTAUTH_URL);

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

        return {
          id: fid.toString(),
          name: credentials?.name || `User ${fid}`,
          image: credentials?.pfp || null,
          provider: 'farcaster',
        };
      },
    }),
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
        username: {
          label: 'Username',
          type: 'text',
          placeholder: 'username',
        },
        displayName: {
          label: 'Display Name',
          type: 'text',
          placeholder: 'Display Name',
        },
        pfpUrl: {
          label: 'Profile Picture URL',
          type: 'text',
          placeholder: 'https://...',
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
            ethereum: viemConnector(),
          });

          const domain = getDomainFromUrl(process.env.NEXTAUTH_URL);

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
            name:
              credentials?.displayName ||
              credentials?.username ||
              `User ${fid}`,
            image: credentials?.pfpUrl || null,
            provider: 'neynar',
            username: credentials?.username || undefined,
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
      if (session?.user) {
        session.user.fid = parseInt(token.sub ?? '');
        // Add provider information to session
        session.user.provider = token.provider as string;
        session.user.username = token.username as string;
      }
      return session;
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.provider = user.provider;
        token.username = user.username;
      }
      return token;
    },
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
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
