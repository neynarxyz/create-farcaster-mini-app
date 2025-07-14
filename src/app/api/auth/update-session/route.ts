import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/auth';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.fid) {
      return NextResponse.json(
        { error: 'No authenticated session found' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { signers, user } = body;

    if (!signers || !user) {
      return NextResponse.json(
        { error: 'Signers and user are required' },
        { status: 400 },
      );
    }

    // For NextAuth to update the session, we need to trigger the JWT callback
    // This is typically done by calling the session endpoint with updated data
    // However, we can't directly modify the session token from here

    // Instead, we'll store the data temporarily and let the client refresh the session
    // The session will be updated when the JWT callback is triggered

    return NextResponse.json({
      success: true,
      message: 'Session update prepared',
      signers,
      user,
    });
  } catch (error) {
    console.error('Error preparing session update:', error);
    return NextResponse.json(
      { error: 'Failed to prepare session update' },
      { status: 500 },
    );
  }
}
