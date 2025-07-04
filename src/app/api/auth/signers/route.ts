import { NextResponse } from 'next/server';
import { getNeynarClient } from '~/lib/neynar';

const requiredParams = ['message', 'signature'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params: Record<string, string | null> = {};
  for (const param of requiredParams) {
    params[param] = searchParams.get(param);
    if (!params[param]) {
      return NextResponse.json(
        {
          error: `${param} parameter is required`,
        },
        { status: 400 }
      );
    }
  }

  const message = params.message as string;
  const signature = params.signature as string;

  try {
    const client = getNeynarClient();
    const data = await client.fetchSigners({ message, signature });
    const signers = data.signers;
    return NextResponse.json({
      signers,
    });
  } catch (error) {
    console.error('Error fetching signers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signers' },
      { status: 500 }
    );
  }
}
