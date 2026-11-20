// One coin with its live pool, market history, bundle check and rewards.
import { NextRequest, NextResponse } from "next/server";
import { K, hashToObj, kv } from "@/lib/kv";
import { liveFor } from "@/lib/markets";
import { getBundle, getCoin } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { mint: string } }) {
  const coin = await getCoin(params.mint);
  if (!coin) return NextResponse.json({ error: "Coin not found" }, { status: 404 });
  const [live, bundle, rewards] = await Promise.all([liveFor([coin]), getBundle(coin.mint), kv(["HGETALL", K.rewards(coin.mint)]).then((a: string[]) => Object.fromEntries(Object.entries(hashToObj(a)).map(([k, v]) => [k, Number(v)])))]);
  return NextResponse.json({ coin, live: live[coin.mint], bundle, rewards: rewards || {} }, { headers: { "cache-control": "public, max-age=4" } });
}
