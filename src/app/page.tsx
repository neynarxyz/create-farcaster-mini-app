import { Metadata } from "next";
import App from "./app";

const appUrl = process.env.NEXT_PUBLIC_URL;

// frame preview metadata
// question: do we need metadata both in this file and in the .well-known/farcaster.json file?
const appName = process.env.NEXT_PUBLIC_FRAME_NAME || "Frames v2 Demo";
const splashImageUrl = process.env.NEXT_PUBLIC_FRAME_SPLASH_IMAGE_URL || `${appUrl}/splash.png`;

const frame = {
  version: "next",
  imageUrl: `${appUrl}/opengraph-image`,
  button: {
    title: process.env.NEXT_PUBLIC_FRAME_BUTTON_TEXT || "Launch Frame",
    action: {
      type: "launch_frame",
      name: appName,
      url: appUrl,
      splashImageUrl,
      splashBackgroundColor: "#f7f7f7",
    },
  },
};

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: appName,
    openGraph: {
      title: appName,
      description: process.env.NEXT_PUBLIC_FRAME_DESCRIPTION || "A Farcaster Frames v2 demo app.",
    },
    other: {
      "fc:frame": JSON.stringify(frame),
    },
  };
}

export default function Home() {
  return (<App />);
}
