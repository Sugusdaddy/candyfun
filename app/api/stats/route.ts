// Platform totals: coins, volume, this week's trader pot and when it is paid.
import { NextResponse } from "next/server";
import { SOL_MINT } from "@/lib/config";
import { K, hashToObj, kv } from "@/lib/kv";
import { liveFor } from "@/lib/markets";
import { usdPrice } from "@/lib/price";
import { listCoins } from "@/lib/store";
import { nextPayoutAt } from "@/lib/week";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const coins = await listCoins(500);
  const [live, statsRaw, keeperRaw, potRaw, solUsd] = await Promise.all([
    liveFor(coins),
    kv(["HGETALL", K.stats]),
    kv(["GET", K.keeper]),
    kv(["HGET", K.quoteLedger(SOL_MINT), "pot"]),
    usdPrice(SOL_MINT).catch(() => 0),
  ]);
  const stats = hashToObj(statsRaw);
  let vol24 = 0;
  let graduated = 0;
  for (const c of coins) {
    const l = live[c.mint];
    if (!l) continue;
    vol24 += l.market.volume24hUsd || 0;
    if (l.graduated) graduated++;
  }
  const potSol = Number(potRaw || 0) / 1e9;
  return NextResponse.json(
    {
      coins: coins.length,
      graduated,
      volume24hUsd: vol24,
      potSol,
      potUsd: potSol * solUsd,
      nextPayoutAt: nextPayoutAt(),
      paidSol: Number(stats.paidSol || 0),
      payouts: Number(stats.payouts || 0),
      vampFeesSol: Number(stats.vampFeesSol || 0),
      keeper: keeperRaw ? JSON.parse(keeperRaw) : null,
    },
    { headers: { "cache-control": "public, max-age=10" } }
  );
}
