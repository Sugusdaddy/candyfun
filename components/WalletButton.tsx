"use client";

import dynamic from "next/dynamic";

/** WalletMultiButton touches `window`, so load it client-only. */
export const WalletButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false, loading: () => <button className="btn">Connect wallet</button> }
);
