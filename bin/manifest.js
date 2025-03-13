// utils to generate a manifest.json file for a frames v2 app
import { mnemonicToAccount } from 'viem/accounts';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function lookupFidByCustodyAddress(custodyAddress, projectPath) {
  // Load environment variables from the project's .env file
  dotenv.config({ path: join(projectPath, '.env') });
  
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    throw new Error('Neynar API key is required. Please set NEYNAR_API_KEY in your .env file');
  }

  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/user/custody-address?custody_address=${custodyAddress}`,
    {
      headers: {
        'accept': 'application/json',
        'x-api-key': apiKey
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to lookup FID: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.user?.fid) {
    throw new Error('No FID found for this custody address');
  }

  return data.user.fid;
}

export async function generateManifest(seedPhrase, projectPath) {
  let account;
  try {
    account = mnemonicToAccount(seedPhrase);
  } catch (error) {
    throw new Error('Invalid seed phrase');
  }
  const custodyAddress = account.address;

  // Look up FID using custody address
  const fid = await lookupFidByCustodyAddress(custodyAddress, projectPath);

  const header = {
    fid,
    type: 'custody', // question: do we want to support type of 'app_key', which indicates the signature is from a registered App Key for the FID
    key: custodyAddress,
  };
  const encodedHeader = Buffer.from(JSON.stringify(header), 'utf-8').toString('base64');

  const payload = {
    domain: 'warpcast.com'
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');

  const signature = await account.signMessage({ 
    message: `${encodedHeader}.${encodedPayload}`
  });
  const encodedSignature = Buffer.from(signature, 'utf-8').toString('base64url');

  const jsonJfs = {
    header: encodedHeader,
    payload: encodedPayload,
    signature: encodedSignature
  };

  return jsonJfs;
}
