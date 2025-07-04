import { NextResponse } from 'next/server';
import { getNeynarClient } from '~/lib/neynar';

export async function GET() {
  try {
    const client = getNeynarClient();
    const response = await client.fetchNonce();
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching nonce:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nonce' },
      { status: 500 }
    );
  }
}
