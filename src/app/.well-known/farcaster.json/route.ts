import { NextResponse } from 'next/server';
import { getFarcasterMetadata } from '../../../lib/utils';

export async function GET() {
  try {
    const config = await getFarcasterMetadata();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error generating metadata:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
