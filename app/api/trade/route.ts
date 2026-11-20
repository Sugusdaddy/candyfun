// Build a buy or sell on a coin's curve for the user's wallet to sign.
//   POST { mint, owner, side: "buy"|"sell", amount: "<raw>", payWith: "sol"|"pair", slippageBps }
import { NextRequest, NextResponse } from "next/server";
import { readMint, readPool } from "@/lib/launchlab";
import { getCoin } from "@/lib/store";
import { isPubkey, rpc } from "@/lib/solana";
import { buildTrade } from "@/lib/trade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const coin = await getCoin(String(b.mint || ""));
    if (!coin) return NextResponse.json({ error: "Coin not found" }, { status: 404 });
    if (!isPubkey(String(b.owner || ""))) return NextResponse.json({ error: "Connect a wallet" }, { status: 400 });
    const side = b.side === "sell" ? "sell" : "buy";
    const payWith = b.payWith === "pair" ? "pair" : "sol";
    const amount = BigInt(String(b.amount || "0"));
    if (amount <= 0n) return NextResponse.json({ error: "Enter an amount" }, { status: 400 });
    const slippageBps = Math.min(5000, Math.max(10, Number(b.slippageBps || 300)));
    const conn = rpc();
    const pool = await readPool(conn, coin.mint, coin.pair);
    if (!pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    if (pool.graduated) return NextResponse.json({ error: "This coin graduated to Raydium: trade it on Jupiter", graduated: true }, { status: 409 });
    const { program } = await readMint(conn, coin.pair);
    const built = await buildTrade({ conn, pool, mint: coin.mint, owner: b.owner, side, amountIn: amount, payWith, slippageBps, quoteProgram: program });
    return NextResponse.json(built);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 200) }, { status: 400 });
  }
}
