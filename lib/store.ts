// Coin records and pending launches.
import { K, getJson, kv, setJson } from "./kv";

export type Coin = {
  mint: string;
  name: string;
  ticker: string;
  description: string;
  image: string;
  metadataUri: string;
  banner?: string | null;
  website?: string;
  twitter?: string;
  telegram?: string;
  tweetUrl?: string | null;
  pair: string; // quote mint
  pairSymbol: string;
  pairDecimals: number;
  platformId: string;
  poolId: string;
  launcher: string;
  launchId: string;
  createSig: string;
  /** The creator's first buy in the launch transaction, raw coin units ("0" when none). */
  devBuyRaw: string;
  /** Anti-vamp fee this coin paid for copying a ticker/name/tweet (0 = original), and what it copied. */
  vampFeeSol?: number;
  vampOf?: string | null;
  createdAt: number;
  curve: { startMcapUsd: number; gradMcapUsd: number; raiseQuote: number; totalFundRaisingB: string; totalSellA: string; locked: string };
  flags: { lookalikeOf: string[]; sameImageAs: string | null };
};

export type PendingLaunch = {
  id: string;
  status: "pending" | "live" | "failed";
  payer: string;
  mint: string;
  poolId: string;
  name: string;
  ticker: string;
  description: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  tweetUrl?: string | null;
  pair: string;
  pairSymbol: string;
  pairDecimals: number;
  image: string;
  metadataUri: string;
  imageSha: string;
  devBuyRaw: string;
  vampFeeLamports: number;
  vampOf: string | null;
  messageSha: string;
  curve: Coin["curve"];
  createdAt: number;
  createSig?: string;
  error?: string;
};

/** Market data the keeper keeps per coin (USD figures use the pair token's USD price). */
export type Market = {
  mcapUsd?: number;
  athUsd?: number;
  priceUsd?: number;
  progress?: number;
  graduated?: boolean;
  volume24hUsd?: number;
  trades24h?: number;
  lastTradeAt?: number;
  holders?: number;
  topHolders?: { w: string; pct: number }[];
  change24h?: number;
  spark?: number[];
  createSlot?: number;
  graduatedAt?: number;
  updatedAt?: number;
};

export type BundleCheck = {
  at: number;
  slots: number;
  buyers: { wallet: string; slot: number; funder: string | null; linked: boolean; reason?: string; holdsPct: number }[];
  linkedHoldPct: number;
  snipers: number;
  devSold: boolean;
  top10Pct: number;
  grade: "A" | "B" | "C" | "D" | "F";
  gradeWhy: string[];
};

export const getCoin = (mint: string) => getJson<Coin>(K.coin(mint));
export const putCoin = (c: Coin) => setJson(K.coin(c.mint), c);

export async function addCoin(c: Coin) {
  await putCoin(c);
  await kv(["LPUSH", K.coins, c.mint]);
  await kv(["HINCRBY", K.stats, "launches", 1]);
  await kv(["LPUSH", K.feed, JSON.stringify({ t: "launch", mint: c.mint, ticker: c.ticker, at: c.createdAt })]);
  await kv(["LTRIM", K.feed, 0, 199]);
}

export async function listMints(n = 500): Promise<string[]> {
  return (await kv(["LRANGE", K.coins, 0, n - 1])) || [];
}

export async function listCoins(n = 500): Promise<Coin[]> {
  const mints = await listMints(n);
  if (!mints.length) return [];
  const raw: (string | null)[] = await kv(["MGET", ...mints.map(K.coin)]);
  return raw.filter(Boolean).map((s) => JSON.parse(s as string) as Coin);
}

export async function marketsFor(mints: string[]): Promise<Record<string, Market>> {
  if (!mints.length) return {};
  const raw: (string | null)[] = await kv(["MGET", ...mints.map(K.market)]);
  const out: Record<string, Market> = {};
  mints.forEach((m, i) => (out[m] = raw[i] ? JSON.parse(raw[i] as string) : {}));
  return out;
}

export const getLaunch = (id: string) => getJson<PendingLaunch>(K.launch(id));
export const putLaunch = (l: PendingLaunch) => setJson(K.launch(l.id), l, 86400);
export const getBundle = (mint: string) => getJson<BundleCheck>(K.bundle(mint));
