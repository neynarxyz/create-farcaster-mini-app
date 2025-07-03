import { NextResponse } from 'next/server';
import { getNeynarClient } from '~/lib/neynar';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const message = searchParams.get('message');
  const signature = searchParams.get('signature');

  if (!message) {
    return NextResponse.json(
      { error: 'Message parameter is required' },
      { status: 400 }
    );
  }

  if (!signature) {
    return NextResponse.json(
      { error: 'Signature parameter is required' },
      { status: 400 }
    );
  }

  const client = getNeynarClient();

  let signers;

  try {
    const data = await client.fetchSigners({ message, signature });
    signers = data.signers;
  } catch (error) {
    console.error('Error fetching signers:', error?.response?.data);
    throw new Error('Failed to fetch signers');
  }
  console.log('signers =>', signers);

  return NextResponse.json({
    signers,
  });
}
