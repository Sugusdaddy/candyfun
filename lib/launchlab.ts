// Raydium LaunchLab for the web (server side): curve sizing and reading pools.
// The launch transaction itself is built in lib/launch.ts. Mirrors keeper/lib/launchlab.mjs.
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  LaunchpadConfig,
  LaunchpadPool,
  getPdaLaunchpadConfigId,
  getPdaLaunchpadPoolId,
} from "@raydium-io/raydium-sdk-v2";
import { LAUNCHPAD_PROGRAM } from "./config";

export const PROGRAM = new PublicKey(LAUNCHPAD_PROGRAM);
export const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
export const SUPPLY_RAW = 1_000_000_000_000_000n;
export const DECIMALS = 6;

export const globalConfigFor = (quote: string | PublicKey) => getPdaLaunchpadConfigId(PROGRAM, new PublicKey(quote), 0, 0).publicKey;
export const poolIdFor = (mint: string | PublicKey, quote: string | PublicKey) =>
  getPdaLaunchpadPoolId(PROGRAM, new PublicKey(mint), new PublicKey(quote)).publicKey;

export type Curve = {
  supply: bigint;
  totalSellA: bigint;
  migrateA: bigint;
  locked: bigint;
  totalFundRaisingB: bigint;
  startMcapUsd: number;
  gradMcapUsd: number;
  raiseQuote: number;
  raiseUsd: number;
};

/**
 * LaunchLab ConstantCurve with supply N, sold S, raised F, migrated A = N − S − locked:
 * start price = F·A/S², final price = F/A, so the graduation multiple is (S/A)². The multiple sets
 * the sold/migrated split; the USD target sets F in the pair token.
 */
export function sizeCurve(o: { startMcapUsd: number; multiple: number; quotePriceUsd: number; quoteDecimals: number; lockedBps?: number }): Curve {
  if (!(o.quotePriceUsd > 0)) throw new Error("No USD price for this pair right now");
  const N = SUPPLY_RAW;
  const locked = (N * BigInt(o.lockedBps || 0)) / 10_000n;
  const free = N - locked;
  const r = Math.sqrt(o.multiple);
  const unit = 10n ** BigInt(DECIMALS);
  const A = BigInt(Math.floor(Number(free / unit) / (1 + r))) * unit;
  const S = free - A;
  const gradMcapUsd = o.startMcapUsd * o.multiple;
  const raiseUsd = (gradMcapUsd * Number(A)) / Number(N);
  const F = BigInt(Math.round((raiseUsd / o.quotePriceUsd) * 10 ** o.quoteDecimals));
  const startMcapQuote = (Number(F) * Number(A)) / Number(S) / Number(S) * Number(N) / 10 ** o.quoteDecimals;
  return {
    supply: N,
    totalSellA: S,
    migrateA: A,
    locked,
    totalFundRaisingB: F,
    startMcapUsd: startMcapQuote * o.quotePriceUsd,
    gradMcapUsd,
    raiseQuote: Number(F) / 10 ** o.quoteDecimals,
    raiseUsd,
  };
}

export type GlobalCfg = { id: string; minSellRateA: bigint; minMigrateRateA: bigint; maxLockRate: bigint; minFundRaisingB: bigint };

export async function readGlobalConfig(conn: Connection, quote: string): Promise<GlobalCfg | null> {
  const id = globalConfigFor(quote);
  const ai = await conn.getAccountInfo(id, "confirmed");
  if (!ai) return null;
  const d: any = LaunchpadConfig.decode(ai.data);
  return {
    id: id.toBase58(),
    minSellRateA: BigInt(d.minSellRateA.toString()),
    minMigrateRateA: BigInt(d.minMigrateRateA.toString()),
    maxLockRate: BigInt(d.maxLockRate.toString()),
    minFundRaisingB: BigInt(d.minFundRaisingB.toString()),
  };
}

export function checkCurve(c: Curve, cfg: GlobalCfg) {
  const rate = (x: bigint) => (x * 1_000_000n) / c.supply;
  if (rate(c.totalSellA) < cfg.minSellRateA) throw new Error("Curve sells too little for this pair");
  if (rate(c.migrateA) < cfg.minMigrateRateA) throw new Error("Curve migrates too little for this pair");
  if (rate(c.locked) > cfg.maxLockRate) throw new Error("Too much supply locked for this pair");
  if (c.totalFundRaisingB < cfg.minFundRaisingB) throw new Error("This pair needs a bigger raise than the curve gives");
}

export async function readMint(conn: Connection, mint: string): Promise<{ decimals: number; program: PublicKey }> {
  const ai = await conn.getAccountInfo(new PublicKey(mint), "confirmed");
  if (!ai) throw new Error("Pair token not found");
  if (!ai.owner.equals(TOKEN_PROGRAM_ID) && !ai.owner.equals(TOKEN_2022_PROGRAM_ID)) throw new Error("Not a token mint");
  return { decimals: ai.data[44], program: ai.owner };
}

export type PoolView = {
  exists: boolean;
  poolId: string;
  status: number;
  graduated: boolean;
  platformId: string;
  creator: string;
  quoteMint: string;
  decimalsQuote: number;
  virtualA: string;
  virtualB: string;
  realA: string;
  realB: string;
  supplyRaw: string;
  totalSellA: string;
  totalFundRaisingB: string;
  priceQuote: number;
  mcapQuote: number;
  raisedQuote: number;
  targetQuote: number;
  progress: number;
  platformFeeRaw: string;
  lockedRaw: string;
};

export function viewPool(poolId: string, data: Buffer): PoolView {
  const p: any = LaunchpadPool.decode(data);
  const big = (v: any) => BigInt(v.toString());
  const vA = big(p.virtualA), vB = big(p.virtualB), rA = big(p.realA), rB = big(p.realB);
  const decA = Number(p.mintDecimalsA), decB = Number(p.mintDecimalsB);
  const left = vA - rA;
  const inQ = vB + rB;
  const priceQuote = left > 0n ? (Number(inQ) / Number(left)) * 10 ** (decA - decB) : 0;
  const supply = Number(big(p.supply)) / 10 ** decA;
  const target = big(p.totalFundRaisingB);
  return {
    exists: true,
    poolId,
    status: Number(p.status),
    graduated: Number(p.status) !== 0,
    platformId: p.platformId.toBase58(),
    creator: p.creator.toBase58(),
    quoteMint: p.mintB.toBase58(),
    decimalsQuote: decB,
    virtualA: vA.toString(),
    virtualB: vB.toString(),
    realA: rA.toString(),
    realB: rB.toString(),
    supplyRaw: big(p.supply).toString(),
    totalSellA: big(p.totalSellA).toString(),
    totalFundRaisingB: target.toString(),
    priceQuote,
    mcapQuote: priceQuote * supply,
    raisedQuote: Number(rB) / 10 ** decB,
    targetQuote: Number(target) / 10 ** decB,
    progress: target > 0n ? Math.min(1, Number(rB) / Number(target)) : 0,
    platformFeeRaw: big(p.platformFee).toString(),
    lockedRaw: big(p.vestingSchedule.totalLockedAmount).toString(),
  };
}

export async function readPool(conn: Connection, mint: string, quote: string): Promise<PoolView | null> {
  const id = poolIdFor(mint, quote);
  const ai = await conn.getAccountInfo(id, "confirmed");
  return ai ? viewPool(id.toBase58(), ai.data) : null;
}
