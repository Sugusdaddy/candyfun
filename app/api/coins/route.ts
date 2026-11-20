// Public coin feed: GET /api/coins?feed=new|trending|graduating|graduated|mcap&limit=50&q=
import { NextRequest, NextResponse } from "next/server";
import { liveFor, sortFeed, type FeedKind } from "@/lib/markets";
import { listCoins } from "@/lib/store";
import { K, kv } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const feed = (q.get("feed") || "new") as FeedKind;
  const limit = Math.min(100, Math.max(1, Number(q.get("limit") || 50)));
  const search = (q.get("q") || "").trim().toLowerCase();
  let coins = await listCoins(500);
  if (search) coins = coins.filter((c) => c.ticker.toLowerCase().includes(search) || c.name.toLowerCase().includes(search) || c.mint === search);
  const live = await liveFor(coins);
  const bundles: (string | null)[] = coins.length ? await kv(["MGET", ...coins.map((c) => K.bundle(c.mint))]) : [];
  const grade: Record<string, string> = {};
  coins.forEach((c, i) => {
    if (bundles[i]) grade[c.mint] = JSON.parse(bundles[i] as string).grade;
  });
  const rows = sortFeed(
    coins.map((c) => ({ ...c, live: live[c.mint] })),
    feed
  ).slice(0, limit);
  return NextResponse.json(
    {
      feed,
      count: rows.length,
      coins: rows.map((c) => ({
        mint: c.mint,
        name: c.name,
        ticker: c.ticker,
        image: c.image,
        description: c.description,
        pair: c.pair,
        pairSymbol: c.pairSymbol,
        launcher: c.launcher,
        createdAt: c.createdAt,
        vampFeeSol: c.vampFeeSol || 0,
        lastTradeAt: c.live.market.lastTradeAt || 0,
        flags: c.flags,
        mcapUsd: c.live.mcapUsd,
        priceUsd: c.live.priceUsd,
        progress: c.live.progress,
        graduated: c.live.graduated,
        volume24hUsd: c.live.market.volume24hUsd || 0,
        athUsd: Math.max(c.live.market.athUsd || 0, c.live.mcapUsd),
        holders: c.live.market.holders || 0,
        change24h: c.live.market.change24h || 0,
        spark: c.live.market.spark || [],
        grade: grade[c.mint] || null,
      })),
    },
    { headers: { "cache-control": "public, max-age=5" } }
  );
}
