// Live market data for coins, read straight from their LaunchLab pools (one getMultipleAccounts per
// 100 coins) and priced in USD through the pair token. The keeper adds what needs history (ATH,
// volume, holders); this file is what makes the numbers live.
import { PublicKey } from "@solana/web3.js";
import { viewPool, type PoolView } from "./launchlab";
import { usdPrices } from "./price";
import { rpc } from "./solana";
import { marketsFor, type Coin, type Market } from "./store";

export type Live = {
  pool: PoolView | null;
  priceUsd: number;
  mcapUsd: number;
  progress: number;
  graduated: boolean;
  raisedQuote: number;
  targetQuote: number;
  pairUsd: number;
  market: Market;
};

const g = globalThis as any;
const memo: Map<string, { at: number; v: Live }> = (g.__runLive ||= new Map());
const TTL = 8_000;

export async function liveFor(coins: Coin[]): Promise<Record<string, Live>> {
  const out: Record<string, Live> = {};
  const now = Date.now();
  const need = coins.filter((c) => {
    const m = memo.get(c.mint);
    if (m && now - m.at < TTL) {
      out[c.mint] = m.v;
      return false;
    }
    return true;
  });
  if (!need.length) return out;

  const conn = rpc();
  const [prices, markets] = await Promise.all([usdPrices(need.map((c) => c.pair)), marketsFor(need.map((c) => c.mint))]);
  for (let i = 0; i < need.length; i += 100) {
    const chunk = need.slice(i, i + 100);
    const accs = await conn.getMultipleAccountsInfo(chunk.map((c) => new PublicKey(c.poolId)), "confirmed").catch(() => chunk.map(() => null));
    chunk.forEach((c, j) => {
      const ai = accs[j];
      const pool = ai ? viewPool(c.poolId, ai.data) : null;
      const pairUsd = prices[c.pair] || 0;
      const v: Live = {
        pool,
        pairUsd,
        priceUsd: pool ? pool.priceQuote * pairUsd : 0,
        mcapUsd: pool ? pool.mcapQuote * pairUsd : markets[c.mint]?.mcapUsd || 0,
        progress: pool ? pool.progress : 0,
        graduated: pool ? pool.graduated : !!markets[c.mint]?.graduated,
        raisedQuote: pool?.raisedQuote || 0,
        targetQuote: pool?.targetQuote || 0,
        market: markets[c.mint] || {},
      };
      memo.set(c.mint, { at: now, v });
      out[c.mint] = v;
    });
  }
  return out;
}

export type FeedCoin = Coin & { live: Live };
export type FeedKind = "new" | "trending" | "graduating" | "graduated" | "mcap";

export function sortFeed(coins: FeedCoin[], kind: FeedKind): FeedCoin[] {
  const list = [...coins];
  switch (kind) {
    case "trending":
      return list
        .filter((c) => !c.live.graduated || (c.live.market.volume24hUsd || 0) > 0)
        .sort((a, b) => (b.live.market.volume24hUsd || 0) - (a.live.market.volume24hUsd || 0) || b.live.mcapUsd - a.live.mcapUsd);
    case "graduating":
      return list.filter((c) => !c.live.graduated).sort((a, b) => b.live.progress - a.live.progress);
    case "graduated":
      return list.filter((c) => c.live.graduated).sort((a, b) => b.live.mcapUsd - a.live.mcapUsd);
    case "mcap":
      return list.sort((a, b) => b.live.mcapUsd - a.live.mcapUsd);
    default:
      return list.sort((a, b) => b.createdAt - a.createdAt);
  }
}
