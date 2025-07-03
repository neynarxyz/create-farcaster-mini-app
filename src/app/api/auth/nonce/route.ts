import { NextResponse } from 'next/server';
import { getNeynarClient } from '~/lib/neynar';

export async function GET() {
  const client = getNeynarClient();

  const response = await client.fetchNonce();

  return NextResponse.json(response);
}
