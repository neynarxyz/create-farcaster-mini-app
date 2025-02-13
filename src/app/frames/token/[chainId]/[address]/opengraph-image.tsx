import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Hello Frame";
export const size = {
  width: 600,
  height: 400,
};

export const contentType = "image/png";

interface Props {
  params: Promise<{
    chainId: string;
    address: string;
  }>;
}

export default async function Image({ params }: Props) {
  const { chainId, address } = await params;
  const token = `eip155:${chainId}/erc20:${address}`;

  return new ImageResponse(
    (
      <div tw="h-full w-full flex flex-col justify-center items-center relative bg-white">
        <h1 tw="text-6xl">View Token</h1>
        <p>{token}</p>
      </div>
    ),
    {
      ...size,
    }
  );
}
