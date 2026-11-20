// Recent trades and OHLC candles for one coin, from the keeper's trade index.
//   GET /api/coin/<mint>/trades?tf=60   (candle size in seconds: 60, 300, 900, 3600)
import { NextRequest, NextResponse } from "next/server";
import { K, kv } from "@/lib/kv";
import { usdPrice } from "@/lib/price";
import { getCoin } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Trade = { sig: string; t: number; w: string; s: "buy" | "sell"; q: string; b: string };

export async function GET(req: NextRequest, { params }: { params: { mint: string } }) {
  const coin = await getCoin(params.mint);
  if (!coin) return NextResponse.json({ error: "Coin not found" }, { status: 404 });
  const tf = [60, 300, 900, 3600].includes(Number(req.nextUrl.searchParams.get("tf"))) ? Number(req.nextUrl.searchParams.get("tf")) : 300;
  const raw: string[] = (await kv(["LRANGE", K.trades(coin.mint), 0, 999])) || [];
  const trades = raw.map((s) => JSON.parse(s) as Trade).reverse(); // oldest first
  const pairUsd = await usdPrice(coin.pair);
  const dec = coin.pairDecimals ?? 9;
  const priced = trades.map((t) => {
    const quote = Number(t.q) / 10 ** dec;
    const tokens = Number(t.b) / 1e6;
    const price = tokens > 0 ? (quote / tokens) * pairUsd : 0;
    return { ...t, quote, tokens, usd: quote * pairUsd, price };
  });

  // Candles in market cap (USD) so the chart reads like DexScreener's mcap view.
  const supply = 1e9;
  const candles: { time: number; open: number; high: number; low: number; close: number; volume: number }[] = [];
  // Trades routed through aggregators can show a misleading per-trade price: drop anything more than
  // 3x away from the median of the previous 15 good prices.
  const recentGood: number[] = [];
  const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  for (const t of priced) {
    if (!t.price) continue;
    if (recentGood.length >= 5) {
      const md = median(recentGood);
      if (t.price > md * 3 || t.price < md / 3) continue;
    }
    recentGood.push(t.price);
    if (recentGood.length > 15) recentGood.shift();
    const time = Math.floor(t.t / 1000 / tf) * tf;
    const m = t.price * supply;
    const last = candles[candles.length - 1];
    if (last && last.time === time) {
      last.high = Math.max(last.high, m);
      last.low = Math.min(last.low, m);
      last.close = m;
      last.volume += t.usd;
    } else {
      const open = last ? last.close : m;
      candles.push({ time, open, high: Math.max(open, m), low: Math.min(open, m), close: m, volume: t.usd });
    }
  }
  return NextResponse.json(
    {
      tf,
      candles,
      trades: priced.slice(-60).reverse().map((t) => ({ sig: t.sig, t: t.t, w: t.w, s: t.s, usd: t.usd, tokens: t.tokens, quote: t.quote, price: t.price })),
    },
    { headers: { "cache-control": "public, max-age=5" } }
  );
}
