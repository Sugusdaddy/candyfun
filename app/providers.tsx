"use client";

import { ReactNode, useMemo } from "react";
import { Buffer } from "buffer";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { RPC_URL } from "@/lib/config";
import "@solana/wallet-adapter-react-ui/styles.css";

if (typeof window !== "undefined" && !(window as unknown as { Buffer?: unknown }).Buffer) {
  (window as unknown as { Buffer: unknown }).Buffer = Buffer;
}

export function Providers({ children }: { children: ReactNode }) {
  // Browser traffic goes through our own /api/rpc proxy (the public RPC rejects
  // browser origins and the Helius key must stay server-side).
  const endpoint = useMemo(
    () => (typeof window !== "undefined" ? window.location.origin + "/api/rpc" : RPC_URL),
    []
  );
  // Installed wallets (Phantom, Backpack, Solflare…) are auto-detected via Wallet Standard.
  // Solflare is also listed explicitly so it always appears (install link / web wallet).
  const wallets = useMemo(() => [new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
