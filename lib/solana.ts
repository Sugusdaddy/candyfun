// Server-only Solana helpers.
import { Connection, PublicKey } from "@solana/web3.js";

export function rpc(): Connection {
  const url = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
  return new Connection(url, "confirmed");
}

export function isPubkey(s: string): boolean {
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}
