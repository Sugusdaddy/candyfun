import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Browser-side Solana RPC proxy: the public mainnet RPC rejects browser origins
// and the Helius key must not ship in the bundle. Only the methods the wallet
// flow needs are allowed. On a Helius rate limit the call falls back to the
// public RPC (server-to-server calls are accepted there).
const ALLOWED = new Set([
  "getLatestBlockhash",
  "sendTransaction",
  "simulateTransaction",
  "getSignatureStatuses",
  "getTransaction",
  "getBalance",
  "getAccountInfo",
  "getMultipleAccounts",
  "getFeeForMessage",
  "getRecentPrioritizationFees",
  "getBlockHeight",
  "getSlot",
  "getVersion",
  "getMinimumBalanceForRentExemption",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getEpochInfo",
  "isBlockhashValid",
]);
const FALLBACK = process.env.RPC_FALLBACK_URL || "https://api.mainnet-beta.solana.com";

export async function POST(req: NextRequest) {
  const upstream = process.env.RPC_URL;
  if (!upstream) return NextResponse.json({ error: "RPC not configured" }, { status: 500 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const calls = Array.isArray(body) ? body : [body];
  if (calls.length > 10) return NextResponse.json({ error: "too many calls" }, { status: 400 });
  for (const c of calls) {
    if (!c || typeof c.method !== "string" || !ALLOWED.has(c.method)) {
      return NextResponse.json({ jsonrpc: "2.0", id: c?.id ?? null, error: { code: -32601, message: "method not allowed" } }, { status: 403 });
    }
  }
  const payload = JSON.stringify(body);
  const send = (url: string) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: payload, cache: "no-store" });
  let r = await send(upstream);
  if (r.status === 429) {
    await new Promise((res) => setTimeout(res, 500));
    r = await send(upstream);
    if (r.status === 429) r = await send(FALLBACK);
  }
  const text = await r.text();
  return new NextResponse(text, { status: r.status, headers: { "content-type": "application/json" } });
}
