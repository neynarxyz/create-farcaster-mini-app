import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/auth';
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

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.fid) {
      return NextResponse.json(
        { error: 'No authenticated session found' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { message, signature, signers, user } = body;

    if (!message || !signature || !signers) {
      return NextResponse.json(
        { error: 'Message, signature, and signers are required' },
        { status: 400 }
      );
    }

    // Since we can't directly modify the session token here,
    // we'll return the data and let the client trigger a session update
    // The client will need to call getSession() to refresh the session

    return NextResponse.json({
      success: true,
      message: 'Session data prepared for update',
      signers,
      user,
    });
  } catch (error) {
    console.error('Error updating session signers:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}
