import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_URL;

  let accountAssociation; // TODO: add type
  try {
    const manifestPath = join(process.cwd(), 'public/manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    accountAssociation = manifest;
  } catch (error) {
    console.warn('Warning: manifest.json not found or invalid. Frame will not be associated with an account.');
    accountAssociation = null;
  }

  const config = {
    ...(accountAssociation && { accountAssociation }),
    frame: {
      version: "1",
      name: process.env.NEXT_PUBLIC_FRAME_NAME || "Frames v2 Demo",
      iconUrl: `${appUrl}/icon.png`,
      homeUrl: appUrl,
      imageUrl: `${appUrl}/frames/hello/opengraph-image`,
      buttonTitle: "Launch Frame",
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#f7f7f7",
      webhookUrl: `${appUrl}/api/webhook`,
    },
  };

  return Response.json(config);
}
