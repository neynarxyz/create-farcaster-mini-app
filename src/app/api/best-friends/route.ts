import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const apiKey = process.env.NEYNAR_API_KEY;
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get('fid');
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Neynar API key is not configured. Please add NEYNAR_API_KEY to your environment variables.' },
      { status: 500 }
    );
  }

  if (!fid) {
    return NextResponse.json(
      { error: 'FID parameter is required' },
      { status: 400 }
    );
  }

  try {
    const neynar = new NeynarAPIClient({ apiKey });
    const { users } = await neynar.fetchUserFollowers({
      fid: parseInt(fid),
      limit: 3,
      viewerFid: parseInt(fid),
    });

    const bestFriends = users.map(user => ({
      fid: user.user?.fid,
      username: user.user?.username,
    }));

    return NextResponse.json({ bestFriends });
  } catch (error) {
    console.error('Failed to fetch best friends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch best friends. Please check your Neynar API key and try again.' },
      { status: 500 }
    );
  }
} 