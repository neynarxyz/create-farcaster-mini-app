import { NextResponse } from 'next/server';
import { getNeynarClient } from '~/lib/neynar';
import { mnemonicToAccount } from 'viem/accounts';

const postRequiredFields = ['signerUuid', 'publicKey'];

const SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN = {
  name: 'Farcaster SignedKeyRequestValidator',
  version: '1',
  chainId: 10,
  verifyingContract:
    '0x00000000fc700472606ed4fa22623acf62c60553' as `0x${string}`,
};

const SIGNED_KEY_REQUEST_TYPE = [
  { name: 'requestFid', type: 'uint256' },
  { name: 'key', type: 'bytes' },
  { name: 'deadline', type: 'uint256' },
];

export async function POST(request: Request) {
  const body = await request.json();

  // Validate required fields
  for (const field of postRequiredFields) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `${field} is required` },
        { status: 400 }
      );
    }
  }

  const { signerUuid, publicKey, redirectUrl } = body;

  if (redirectUrl && typeof redirectUrl !== 'string') {
    return NextResponse.json(
      { error: 'redirectUrl must be a string' },
      { status: 400 }
    );
  }

  try {
    // Get the app's account from seed phrase
    const seedPhrase = process.env.SEED_PHRASE;
    const shouldSponsor = process.env.SPONSOR_SIGNER === 'true';

    if (!seedPhrase) {
      return NextResponse.json(
        { error: 'App configuration missing (SEED_PHRASE or FID)' },
        { status: 500 }
      );
    }

    const neynarClient = getNeynarClient();

    const account = mnemonicToAccount(seedPhrase);

    const {
      user: { fid },
    } = await neynarClient.lookupUserByCustodyAddress({
      custodyAddress: account.address,
    });

    const appFid = fid;

    // Generate deadline (24 hours from now)
    const deadline = Math.floor(Date.now() / 1000) + 86400;

    // Generate EIP-712 signature
    const signature = await account.signTypedData({
      domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
      types: {
        SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE,
      },
      primaryType: 'SignedKeyRequest',
      message: {
        requestFid: BigInt(appFid),
        key: publicKey,
        deadline: BigInt(deadline),
      },
    });

    const signer = await neynarClient.registerSignedKey({
      appFid,
      deadline,
      signature,
      signerUuid,
      ...(redirectUrl && { redirectUrl }),
      ...(shouldSponsor && { sponsor: { sponsored_by_neynar: true } }),
    });

    return NextResponse.json(signer);
  } catch (error) {
    console.error('Error registering signed key:', error);
    return NextResponse.json(
      { error: 'Failed to register signed key' },
      { status: 500 }
    );
  }
}
