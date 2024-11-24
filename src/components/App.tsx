"use client";

import dynamic from "next/dynamic";

const Demo = dynamic(() => import("./Demo"), {
  ssr: false,
});

const WagmiConfig = dynamic(() => import("./WagmiProvider"), {
  ssr: false,
});

export function App() {
  return (
    <WagmiConfig>
      <Demo />
    </WagmiConfig>
  );
}
