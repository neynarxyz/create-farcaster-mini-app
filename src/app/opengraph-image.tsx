import { ImageResponse } from "next/og";
import { APP_NAME } from "~/lib/constants";

export const alt = APP_NAME;
export const size = {
  width: 600,
  height: 400,
};

export const contentType = "image/png";

// dynamically generated OG image for frame preview
export default async function Image() {
  return new ImageResponse(
    (
      <div tw="h-full w-full flex flex-col justify-center items-center relative bg-white">
        <h1 tw="text-6xl">{alt}</h1>
      </div>
    ),
    {
      ...size,
    }
  );
}
