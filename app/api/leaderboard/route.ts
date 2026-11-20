// The weekly airdrop, live: this week's volume ranking, the pot it will share, and past airdrops.
import { NextResponse } from "next/server";
import { REWARDS, SOL_MINT } from "@/lib/config";
import { K, hashToObj, kv } from "@/lib/kv";
import { usdPrice } from "@/lib/price";
import { nextPayoutAt, weekKey } from "@/lib/week";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const week = weekKey();
  const [volRaw, botsRaw, potRaw, pastRaw, solUsd] = await Promise.all([
    kv(["HGETALL", K.traderVol(week)]),
    kv(["HGETALL", K.bots(week)]),
    kv(["HGET", K.quoteLedger(SOL_MINT), "pot"]),
    kv(["LRANGE", K.payouts, 0, 11]),
    usdPrice(SOL_MINT).catch(() => 0),
  ]);
  const bots = new Set(Object.keys(hashToObj(botsRaw)));
  const all = Object.entries(hashToObj(volRaw))
    .map(([wallet, usd]) => ({ wallet, usd: Number(usd) }))
    .filter((r) => r.usd > 0 && !bots.has(r.wallet))
    .sort((a, b) => b.usd - a.usd);
  const top = all.slice(0, REWARDS.topN);
  const topUsd = top.reduce((a, r) => a + r.usd, 0);
  const potSol = Number(potRaw || 0) / 1e9;
  return NextResponse.json(
    {
      week,
      endsAt: nextPayoutAt(),
      traders: all.length,
      bots: bots.size,
      totalUsd: all.reduce((a, r) => a + r.usd, 0),
      potSol,
      potUsd: potSol * solUsd,
      // The pot is shared among the top N only, in proportion to their volume.
      rows: top.map((r, i) => ({ rank: i + 1, ...r, share: topUsd ? r.usd / topUsd : 0, estSol: topUsd ? (potSol * r.usd) / topUsd : 0 })),
      past: ((pastRaw as string[]) || []).map((s) => JSON.parse(s)),
    },
    { headers: { "cache-control": "public, max-age=20" } }
  );
}
