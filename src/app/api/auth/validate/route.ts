import { NextResponse } from 'next/server';
import { createClient, Errors } from '@farcaster/quick-auth';

const client = createClient();

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Get domain from environment or request
    const domain = process.env.NEXT_PUBLIC_URL
      ? new URL(process.env.NEXT_PUBLIC_URL).hostname
      : request.headers.get('host') || 'localhost';

    try {
      // Use the official QuickAuth library to verify the JWT
      const payload = await client.verifyJwt({
        token,
        domain,
      });

      return NextResponse.json({
        success: true,
        user: {
          fid: payload.sub,
        },
      });
    } catch (e) {
      if (e instanceof Errors.InvalidTokenError) {
        console.info('Invalid token:', e.message);
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      throw e;
    }
  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}