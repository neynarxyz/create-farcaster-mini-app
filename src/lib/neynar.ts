import { NeynarAPIClient } from '@neynar/nodejs-sdk';

let neynarClient: NeynarAPIClient | null = null;

export function getNeynarClient() {
  if (!neynarClient) {
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      throw new Error('NEYNAR_API_KEY not configured');
    }
    neynarClient = new NeynarAPIClient(apiKey);
  }
  return neynarClient;
}

// Example usage:
// const client = getNeynarClient();
// const user = await client.lookupUserByFid(fid); 