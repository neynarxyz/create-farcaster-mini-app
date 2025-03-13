// utils to generate a manifest.json file for a frames v2 app
import { mnemonicToAccount } from 'viem/accounts';

export async function generateManifest(fid, seedPhrase) {
  if (!Number.isInteger(fid) || fid <= 0) {
    throw new Error('FID must be a positive integer');
  }

  let account;
  try {
    account = mnemonicToAccount(seedPhrase);
  } catch (error) {
    throw new Error('Invalid seed phrase');
  }
  const custodyAddress = account.address;

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
