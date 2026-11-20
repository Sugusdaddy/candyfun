import { loadEnv } from "./env.mjs";
loadEnv();

const num = (k, d) => (process.env[k] !== undefined && process.env[k] !== "" ? Number(process.env[k]) : d);

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const LAUNCHLAB_AUTH = "WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh";
export const CPMM_AUTH = "GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL";

export const CFG = {
  rpc: process.env.RPC_URL || "https://api.mainnet-beta.solana.com",
  rpcFallback: process.env.RPC_FALLBACK_URL || "https://api.mainnet-beta.solana.com",
  jupiterBase: process.env.JUPITER_BASE || "https://lite-api.jup.ag/swap/v1",
  dry: process.argv.includes("--dry") || process.env.DRY === "1",
  once: process.argv.includes("--once"),
  intervalSec: num("INTERVAL_SEC", 60),

  platformId: process.env.PLATFORM_ID || process.env.NEXT_PUBLIC_PLATFORM_ID || "",
  /** Candyfun's platform fee as a fraction of volume (0.1%), and Raydium's protocol fee. */
  platformRate: 0.001,
  raydiumRate: 0.0025,

  /** Claim a platform vault once it holds at least this much (USD). */
  minClaimUsd: num("MIN_CLAIM_USD", 5),
  /** Swap a non-SOL pot to SOL once it is worth this much (USD). */
  minSwapUsd: num("MIN_SWAP_USD", 5),
  /** Keep this much SOL in the fee wallet for network fees. It is never part of the pot. */
  minOperatingSol: num("MIN_OPERATING_SOL", 0.05),

  /** Weekly trader airdrop: the previous week's top wallets by volume, pro rata, in SOL. */
  topN: num("REWARDS_TOP_N", 100),
  /** A wallet with more trades than this in any one hour is a bot for that week. */
  botTradesPerHour: num("BOT_TRADES_PER_HOUR", 300),
  /** Shares below this stay in the pot for the next week (also keeps transfers above rent dust). */
  minPayoutSol: num("MIN_PAYOUT_SOL", 0.001),
  /** No airdrop while the whole pot is below this; it rolls over. */
  minPotSol: num("MIN_POT_SOL", 0.05),

  bundleSlots: 20,
  bundleAfterSec: 90,
  holdersEveryMin: num("HOLDERS_EVERY_MIN", 10),
};
