import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { mnemonicToAccount } from 'viem/accounts';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getSecretEnvVars() {
  const seedPhrase = process.env.SEED_PHRASE;
  const fid = process.env.FID;
  
  if (!seedPhrase || !fid) {
    return null;
  }

  return { seedPhrase, fid };
}

export async function generateFarcasterMetadata() {
  const appUrl = process.env.NEXT_PUBLIC_URL;
  if (!appUrl) {
    throw new Error('NEXT_PUBLIC_URL not configured');
  }

  // Get the domain from the URL (without https:// prefix)
  const domain = new URL(appUrl).hostname;
  console.log('Using domain for manifest:', domain);

  const secretEnvVars = getSecretEnvVars();
  if (!secretEnvVars) {
    console.warn('No seed phrase or FID found in environment variables -- generating unsigned metadata');
  }

  let accountAssociation;
  if (secretEnvVars) {
    // Generate account from seed phrase
    const account = mnemonicToAccount(secretEnvVars.seedPhrase);
    const custodyAddress = account.address;

    const header = {
      fid: parseInt(secretEnvVars.fid),
      type: 'custody',
      key: custodyAddress,
    };
    const encodedHeader = Buffer.from(JSON.stringify(header), 'utf-8').toString('base64');

    const payload = {
      domain
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');

    const signature = await account.signMessage({ 
      message: `${encodedHeader}.${encodedPayload}`
    });
    const encodedSignature = Buffer.from(signature, 'utf-8').toString('base64url');

    accountAssociation = {
      header: encodedHeader,
      payload: encodedPayload,
      signature: encodedSignature
    };
  }

  return {
    accountAssociation,
    frame: {
      version: "1",
      name: process.env.NEXT_PUBLIC_FRAME_NAME || "Frames v2 Demo",
      iconUrl: `${appUrl}/icon.png`,
      homeUrl: appUrl,
      imageUrl: `${appUrl}/opengraph-image`,
      buttonTitle: process.env.NEXT_PUBLIC_FRAME_BUTTON_TEXT || "Launch Frame",
      splashImageUrl: process.env.NEXT_PUBLIC_FRAME_SPLASH_IMAGE_URL || `${appUrl}/splash.png`,
      splashBackgroundColor: "#f7f7f7",
      webhookUrl: `${appUrl}/api/webhook`,
    },
  };
}
