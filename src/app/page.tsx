import { Metadata } from "next";
import App from "./app";
import { APP_URL, APP_NAME, APP_DESCRIPTION, APP_OG_IMAGE_URL, APP_ICON_URL, APP_SPLASH_URL, APP_SPLASH_BACKGROUND_COLOR, APP_BUTTON_TEXT } from "~/lib/constants";

const framePreviewMetadata = {
  version: "next",
  imageUrl: APP_OG_IMAGE_URL,
  button: {
    title: APP_BUTTON_TEXT,
    action: {
      type: "launch_frame",
      name: APP_NAME,
      url: APP_URL,
      splashImageUrl: APP_SPLASH_URL,
      iconUrl: APP_ICON_URL,
      splashBackgroundColor: APP_SPLASH_BACKGROUND_COLOR,
    },
  },
};

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: APP_NAME,
    openGraph: {
      title: APP_NAME,
      description: APP_DESCRIPTION,
    },
    other: {
      "fc:frame": JSON.stringify(framePreviewMetadata),
    },
  };
}

export default function Home() {
  return (<App />);
}
