// Everything the keeper needs to know about Raydium LaunchLab, in one place.
//
// Candyfun has no program of its own: it is one LaunchLab platform config. Coins are created by
// their creators' own wallets (see lib/launch.ts); the curve is sized so every coin starts at the
// same USD market cap whatever it is paired with.
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { LaunchpadPool, LaunchpadConfig, PlatformConfig, getPdaLaunchpadAuth, getPdaLaunchpadConfigId, getPdaLaunchpadPoolId, getPdaLaunchpadVaultId, getPdaPlatformId, getPdaMetadataKey, initializeV2, createPlatformConfig } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";


export const LAUNCHPAD_PROGRAM = new PublicKey("LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj");
export const CPMM_PROGRAM = new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C");
export const METAPLEX_PROGRAM = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
export const WSOL = new PublicKey("So11111111111111111111111111111111111111112");
export const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export const SUPPLY_RAW = 1_000_000_000_000_000n; // 1B with 6 decimals
export const DECIMALS = 6;

/**
 * Candyfun's one LaunchLab platform config.
 *
 * - `feeRate` 1000 of 1,000,000 = 0.1% per trade on the curve, on top of Raydium's own 0.25%.
 *   All of it is claimed by the fee wallet and paid back to traders every week.
 * - no creator fee, no vested supply, LP 100% burned at graduation.
 * - after graduation the coin trades on Raydium CPMM config `D4FPEr…` (0.25% + 0.05% creator fee);
 *   `platformCpCreator` points that 0.05% at the fee wallet, so it joins the same pot.
 */
export const PLATFORM = {
  name: "Candyfun",
  feeRate: 1000,
  creatorFeeRate: 0,
  platformVestingScale: 0,
  cpConfig: new PublicKey("D4FPEruKEHrG5TenZ2mpDGEfu1iUvTiqBxvpU8HLBvC2"),
  traderFeePct: 0.35,
  gradFeePct: 0.3,
};

export const platformIdFor = (admin) => getPdaPlatformId(LAUNCHPAD_PROGRAM, new PublicKey(admin)).publicKey;
export const globalConfigFor = (quoteMint) => getPdaLaunchpadConfigId(LAUNCHPAD_PROGRAM, new PublicKey(quoteMint), 0, 0).publicKey;
export const poolIdFor = (mint, quoteMint) =>
  getPdaLaunchpadPoolId(LAUNCHPAD_PROGRAM, new PublicKey(mint), new PublicKey(quoteMint)).publicKey;

// ── the curve ───────────────────────────────────────────────────────────────
//
// LaunchLab's ConstantCurve, for supply N, sold S, raised F and migrated A = N − S − locked:
//   virtualA = S² / (S − A),  virtualB = F·A / (S − A)
//   start price = F·A / S²,   final price = F / A,   graduation multiple = (S / A)²
// (checked against a live pool: Peak's DON has virtualA = 1.073025e15 for S = 793.1M, A = 206.9M.)
//
// So the multiple fixes the split between sold and migrated supply, and the USD target fixes F.

/**
 * Size a curve so the coin starts at `startMcapUsd` and graduates at `startMcapUsd × multiple`,
 * whatever the quote. Returns raw amounts ready for `initialize_v2`.
 */
export function sizeCurve({ startMcapUsd, multiple, quotePriceUsd, quoteDecimals, lockedBps = 0 }) {
  if (!(quotePriceUsd > 0)) throw new Error("no USD price for the pair token");
  if (!(multiple > 1)) throw new Error("graduation multiple must be above 1");
  const N = SUPPLY_RAW;
  const locked = (N * BigInt(lockedBps)) / 10_000n;
  const free = N - locked;
  const r = Math.sqrt(multiple); // S / A
  // A = free / (1 + r), rounded down to a whole token so the numbers stay readable on-chain.
  const unit = 10n ** BigInt(DECIMALS);
  let A = (BigInt(Math.floor(Number(free / unit) / (1 + r))) * unit);
  const S = free - A;
  const gradMcapUsd = startMcapUsd * multiple;
  // Final price F/A per raw token; final mcap = F/A · N → F = gradMcap · A / N, in USD, then in quote.
  const fUsd = (gradMcapUsd * Number(A)) / Number(N);
  const F = BigInt(Math.round((fUsd / quotePriceUsd) * 10 ** quoteDecimals));
  const vA = (S * S) / (S - A);
  const vB = (F * A) / (S - A);
  const startPrice = Number(vB) / Number(vA); // quote raw per base raw
  const startMcapQuote = (startPrice * Number(N)) / 10 ** quoteDecimals;
  return {
    supply: N,
    totalSellA: S,
    migrateA: A,
    locked,
    totalFundRaisingB: F,
    virtualA: vA,
    virtualB: vB,
    startMcapQuote,
    startMcapUsd: startMcapQuote * quotePriceUsd,
    gradMcapUsd,
    raiseUsd: fUsd,
    raiseQuote: Number(F) / 10 ** quoteDecimals,
  };
}

/** Check a sized curve against the quote's LaunchLab global config. Throws with a readable reason. */
export function checkCurve(curve, cfg) {
  const N = curve.supply;
  const sellRate = (curve.totalSellA * 1_000_000n) / N;
  const migrateRate = (curve.migrateA * 1_000_000n) / N;
  const lockRate = (curve.locked * 1_000_000n) / N;
  if (sellRate < BigInt(cfg.minSellRateA)) throw new Error(`sell rate ${sellRate} below the pair's minimum ${cfg.minSellRateA}`);
  if (migrateRate < BigInt(cfg.minMigrateRateA)) throw new Error(`migrate rate ${migrateRate} below the pair's minimum ${cfg.minMigrateRateA}`);
  if (lockRate > BigInt(cfg.maxLockRate)) throw new Error("locked share above the pair's maximum");
  if (curve.totalFundRaisingB < BigInt(cfg.minFundRaisingB))
    throw new Error(`raise too small for this pair (min ${cfg.minFundRaisingB} raw)`);
}

/** The pair token's LaunchLab global config, decoded. Null when Raydium has not enabled it. */
export async function readGlobalConfig(conn, quoteMint) {
  const id = globalConfigFor(quoteMint);
  const ai = await conn.getAccountInfo(id, "confirmed");
  if (!ai) return null;
  const d = LaunchpadConfig.decode(ai.data);
  return {
    id: id.toBase58(),
    mintB: d.mintB.toBase58(),
    tradeFeeRate: d.tradeFeeRate.toString(),
    migrateFee: d.migrateFee.toString(),
    minSupplyA: d.minSupplyA.toString(),
    maxLockRate: d.maxLockRate.toString(),
    minSellRateA: d.minSellRateA.toString(),
    minMigrateRateA: d.minMigrateRateA.toString(),
    minFundRaisingB: d.minFundRaisingB.toString(),
  };
}

/** Decimals and token program of a mint. */
export async function readMint(conn, mint) {
  const ai = await conn.getAccountInfo(new PublicKey(mint), "confirmed");
  if (!ai) throw new Error("pair token not found");
  const program = ai.owner;
  if (!program.equals(TOKEN_PROGRAM_ID) && !program.equals(TOKEN_2022_PROGRAM_ID)) throw new Error("not a token mint");
  return { decimals: ai.data[44], program };
}

/** The platform config instruction (run once by scripts/create-platform.mjs). */
export function buildCreatePlatformIx({ admin, feeWallet, web, img }) {
  const m = PLATFORM;
  const platformId = platformIdFor(admin);
  const ix = createPlatformConfig(
    LAUNCHPAD_PROGRAM,
    admin,
    feeWallet, // platformClaimFeeWallet
    feeWallet, // platformLockNftWallet
    feeWallet, // platformVestingWallet
    platformId,
    m.cpConfig,
    PublicKey.default, // no transfer-fee extension authority: coins are classic SPL
    { platformScale: new BN(0), creatorScale: new BN(0), burnScale: new BN(1_000_000) }, // LP 100% burned
    new BN(m.feeRate),
    new BN(m.creatorFeeRate),
    m.name,
    web,
    img,
    new BN(m.platformVestingScale)
  );
  return { ix, platformId };
}

/** Read a platform config back (used to check what is live). */
export async function readPlatform(conn, platformId) {
  const ai = await conn.getAccountInfo(new PublicKey(platformId), "confirmed");
  if (!ai) return null;
  const p = PlatformConfig.decode(ai.data);
  const str = (a) => Buffer.from(a).toString("utf8").replace(/\0+$/, "");
  return {
    name: str(p.name),
    web: str(p.web),
    img: str(p.img),
    feeRate: p.feeRate.toString(),
    creatorFeeRate: p.creatorFeeRate.toString(),
    burnScale: p.burnScale.toString(),
    platformVestingScale: p.platformVestingScale.toString(),
    claimFeeWallet: p.platformClaimFeeWallet.toBase58(),
    cpConfigId: p.cpConfigId.toBase58(),
    platformCpCreator: p.platformCpCreator.toBase58(),
  };
}

// ── reading a pool ──────────────────────────────────────────────────────────

export function decodePool(data) {
  return LaunchpadPool.decode(data);
}

/** Price, mcap and progress of a pool, in the quote token. */
export function poolStats(p) {
  const big = (v) => BigInt(v.toString());
  const virtualA = big(p.virtualA), virtualB = big(p.virtualB), realA = big(p.realA), realB = big(p.realB);
  const decA = Number(p.mintDecimalsA), decB = Number(p.mintDecimalsB);
  const baseLeft = virtualA - realA;
  const quoteIn = virtualB + realB;
  const priceQuote = baseLeft > 0n ? (Number(quoteIn) / Number(baseLeft)) * 10 ** (decA - decB) : 0;
  const supply = Number(big(p.supply)) / 10 ** decA;
  const target = big(p.totalFundRaisingB);
  return {
    status: Number(p.status),
    graduated: Number(p.status) !== 0,
    priceQuote,
    mcapQuote: priceQuote * supply,
    raisedQuote: Number(realB) / 10 ** decB,
    targetQuote: Number(target) / 10 ** decB,
    progress: target > 0n ? Math.min(1, Number(realB) / Number(target)) : 0,
    platformFeeRaw: big(p.platformFee),
  };
}
