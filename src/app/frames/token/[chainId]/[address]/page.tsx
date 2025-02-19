import { Metadata } from "next";

const appUrl = process.env.NEXT_PUBLIC_URL;

interface Props {
  params: Promise<{
    chainId: string;
    address: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chainId, address } = await params;
  const token = `eip155:${chainId}/erc20:${address}`;

  const frame = {
    version: "next",
    imageUrl: `${appUrl}/frames/token/${chainId}/${address}/opengraph-image`,
    aspectRatio: "1:1",
    button: {
      title: "View Token",
      action: {
        type: "view_token",
        token,
      },
    },
  };

  return {
    title: "View Token",
    description: token,
    openGraph: {
      title: "View Token",
      description: token,
    },
    other: {
      "fc:frame": JSON.stringify(frame),
    },
  };
}

export default async function HelloNameFrame({ params }: Props) {
  const { chainId, address } = await params;
  const token = `eip155:${chainId}/erc20:${address}`;

  return <h1>View token: {token}</h1>;
}
