import type { Metadata } from "next";

import { getSession } from "~/auth"
import "~/app/globals.css";
import { Providers } from "~/app/providers";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_FRAME_NAME || "Frames v2 Demo",
  description: process.env.NEXT_PUBLIC_FRAME_DESCRIPTION || "A Farcaster Frames v2 demo app",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  console.log('Environment variables:');
  console.log('NEXT_PUBLIC_URL:', process.env.NEXT_PUBLIC_URL);
  console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
  
  const session = await getSession()
  console.log('Session:', session);
  
  return (
    <html lang="en">
      <body>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
