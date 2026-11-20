// Market record per coin: live pool state priced in USD, ATH, 24 h volume, last trade, holders.
// The web reads the pool live too; this record adds everything that needs history.
import { PublicKey } from "@solana/web3.js";
import { K, getJson, kv, setJson } from "./kv.mjs";
import { conn } from "./solana.mjs";
import { decodePool, poolStats } from "./launchlab.mjs";

export async function readPools(coins) {
  const out = {};
  for (let i = 0; i < coins.length; i += 100) {
    const chunk = coins.slice(i, i + 100);
    const infos = await conn.getMultipleAccountsInfo(chunk.map((c) => new PublicKey(c.poolId)), "confirmed");
    chunk.forEach((c, j) => {
      if (infos[j]) {
        const p = decodePool(infos[j].data);
        out[c.mint] = { raw: p, stats: poolStats(p) };
      }
    });
  }
  return out;
}

/** USD price of one trade: pair amount per token, priced with today's pair price. */
const tradePrice = (t, dec, pairUsd) => (Number(t.b) > 0 ? ((Number(t.q) / 10 ** dec) / (Number(t.b) / 1e6)) * pairUsd : 0);

/** Top holders as share of supply (pools and the fee wallet are already excluded from the map). */
export function topHolders(map, supplyRaw, n = 10) {
  const supply = Number(supplyRaw) || 1e15;
  return [...map.entries()]
    .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0))
    .slice(0, n)
    .map(([w, amt]) => ({ w, pct: (Number(amt) / supply) * 100 }));
}

export async function updateMarket(coin, pool, pairUsd, extra = {}) {
  const prev = (await getJson(K.market(coin.mint))) || {};
  const recent = ((await kv(["LRANGE", K.trades(coin.mint), 0, 999])) || []).map((s) => JSON.parse(s));
  const dayAgo = Date.now() - 86400_000;
  const dec = coin.pairDecimals ?? 9;
  let vol = 0;
  let trades24h = 0;
  for (const t of recent) {
    if (t.t < dayAgo) break;
    vol += (Number(t.q) / 10 ** dec) * pairUsd;
    trades24h++;
  }
  const mcapUsd = pool ? pool.stats.mcapQuote * pairUsd : prev.mcapUsd || 0;
  const priceNow = pool ? pool.stats.priceQuote * pairUsd : prev.priceUsd || 0;
  // Sparkline: 24 hourly closes from the trade list (oldest → newest), ending at the live price.
  const hours = 24;
  const spark = [];
  const sorted = [...recent].reverse();
  let last = sorted.length ? tradePrice(sorted[0], dec, pairUsd) : priceNow;
  let i = 0;
  for (let h = hours - 1; h >= 0; h--) {
    const until = Date.now() - h * 3600_000;
    while (i < sorted.length && sorted[i].t <= until) last = tradePrice(sorted[i++], dec, pairUsd) || last;
    spark.push(Number(last.toPrecision(6)));
  }
  spark[spark.length - 1] = priceNow || spark[spark.length - 1];
  const dayOld = sorted.find((t) => t.t >= dayAgo);
  const open24 = dayOld ? tradePrice(dayOld, dec, pairUsd) : 0;
  const change24h = open24 > 0 && priceNow > 0 ? (priceNow / open24 - 1) * 100 : 0;
  const m = {
    ...prev,
    ...extra,
    mcapUsd,
    priceUsd: pool ? pool.stats.priceQuote * pairUsd : prev.priceUsd || 0,
    athUsd: Math.max(prev.athUsd || 0, mcapUsd, coin.curve?.startMcapUsd || 0),
    progress: pool ? pool.stats.progress : prev.progress || 0,
    graduated: pool ? pool.stats.graduated : !!prev.graduated,
    volume24hUsd: vol,
    change24h,
    spark,
    trades24h,
    lastTradeAt: recent[0]?.t || prev.lastTradeAt || 0,
    updatedAt: Date.now(),
  };
  if (m.graduated && !prev.graduated) {
    m.graduatedAt = Date.now();
    await kv(["LPUSH", K.feed, JSON.stringify({ t: "graduated", mint: coin.mint, ticker: coin.ticker, at: Date.now() })]);
  }
  await setJson(K.market(coin.mint), m);
  return m;
}
