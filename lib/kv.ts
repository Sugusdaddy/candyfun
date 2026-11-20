// Storage (server only): Redis over TCP (REDIS_URL) or an in-memory stand-in for local runs
// (KV_MEMORY=1). Everything lives under the `candy:` prefix.
const P = process.env.KV_PREFIX || "candy:";

let redisClient: any = null;
async function getRedis() {
  if (redisClient) return redisClient;
  const { default: Redis } = await import("ioredis");
  redisClient = new Redis(process.env.REDIS_URL as string, { maxRetriesPerRequest: 2, connectTimeout: 5000, enableAutoPipelining: true });
  redisClient.on("error", () => {});
  return redisClient;
}

function normalise(cmd: (string | number)[], res: any) {
  if (String(cmd[0]).toUpperCase() === "HGETALL" && res && !Array.isArray(res)) {
    const out: string[] = [];
    for (const [k, v] of Object.entries(res)) out.push(k, v as string);
    return out;
  }
  return res;
}

export async function kv(cmd: (string | number)[]): Promise<any> {
  if (process.env.KV_MEMORY === "1" || !process.env.REDIS_URL) {
    if (process.env.NODE_ENV === "production" && process.env.KV_MEMORY !== "1") throw new Error("KV not configured");
    return (await import("./memkv.mjs")).memKv(cmd);
  }
  const r = await getRedis();
  const [name, ...args] = cmd;
  return normalise(cmd, await r.call(String(name), ...args.map((a) => String(a))));
}

export const K = {
  coins: P + "coins", // list of mints, newest first
  coin: (m: string) => `${P}coin:${m}`,
  launch: (id: string) => `${P}launch:${id}`,
  launchImage: (id: string) => `${P}launchimg:${id}`,
  market: (m: string) => `${P}market:${m}`, // keeper: ath, volume, last trade, holders
  bundle: (m: string) => `${P}bundle:${m}`, // keeper: bundle check result
  rewards: (m: string) => `${P}rewards:${m}`, // keeper: per-coin reward totals
  lock: (kind: string, key: string) => `${P}lock:${kind}:${key}`,
  vampMutex: P + "vampmutex",
  fold: P + "fold", // hash: folded ticker -> JSON [{mint,ticker,at}]
  image: (sha: string) => `${P}img:${sha}`,
  stats: P + "stats",
  feed: P + "feed",
  keeper: P + "keeper",
  tape: P + "tape",
  payouts: P + "payouts", // list of weekly airdrop summaries, newest first
  payout: (week: string) => `${P}payout:${week}`,
  bots: (week: string) => `${P}bots:${week}`,
  quoteLedger: (q: string) => `${P}qledger:${q}`, // hash: pot -> raw amount waiting for the weekly airdrop
  trades: (m: string) => `${P}trades:${m}`,
  traderVol: (week: string) => `${P}tvol:${week}`,
  ledger: (m: string) => `${P}ledger:${m}`,
  rate: (bucket: string, who: string) => `${P}rate:${bucket}:${who}`,
};

export function hashToObj(arr: string[] | null): Record<string, string> {
  const o: Record<string, string> = {};
  if (!arr) return o;
  for (let i = 0; i < arr.length; i += 2) o[arr[i]] = arr[i + 1];
  return o;
}

export async function getJson<T>(key: string): Promise<T | null> {
  const s = await kv(["GET", key]);
  return s ? (JSON.parse(s) as T) : null;
}

export async function setJson(key: string, value: unknown, exSec?: number) {
  if (exSec) await kv(["SET", key, JSON.stringify(value), "EX", exSec]);
  else await kv(["SET", key, JSON.stringify(value)]);
}

/** Fixed-window rate limit counted in Redis. True when allowed. */
export async function allow(bucket: string, who: string, limit: number, windowSec: number): Promise<boolean> {
  try {
    const key = K.rate(bucket, who);
    const n = Number(await kv(["INCR", key]));
    if (n === 1) await kv(["EXPIRE", key, windowSec]);
    return n <= limit;
  } catch {
    return true;
  }
}

export function clientIp(req: Request): string {
  const h = req.headers;
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "anon";
}
