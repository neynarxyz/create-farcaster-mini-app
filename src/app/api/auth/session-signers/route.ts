import { NextResponse } from 'next/server';
import { getNeynarClient } from '~/lib/neynar';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const message = searchParams.get('message');
    const signature = searchParams.get('signature');

    if (!message || !signature) {
      return NextResponse.json(
        { error: 'Message and signature are required' },
        { status: 400 }
      );
    }

    const client = getNeynarClient();
    const data = await client.fetchSigners({ message, signature });
    const signers = data.signers;

    // Fetch user data if signers exist
    let user = null;
    if (signers && signers.length > 0 && signers[0].fid) {
      const {
        users: [fetchedUser],
      } = await client.fetchBulkUsers({
        fids: [signers[0].fid],
      });
      user = fetchedUser;
    }

    return NextResponse.json({
      signers,
      user,
    });
  } catch (error) {
    console.error('Error in session-signers API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signers' },
      { status: 500 }
    );
  }
}
