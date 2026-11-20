// Public (client-safe) configuration. Static NEXT_PUBLIC_* access only: a dynamic process.env[key]
// is undefined in the browser bundle.
export const SITE_NAME = "Candyfun";
export const SITE_TAGLINE = "The launchpad that keeps nothing.";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3900";
export const X_URL = process.env.NEXT_PUBLIC_X_URL || "";
export const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL || "";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";

/** Candyfun's Raydium LaunchLab platform config. Every coin is created under it. */
export const PLATFORM_ID = process.env.NEXT_PUBLIC_PLATFORM_ID || "";
/** Claims the 0.1% and pays it back to traders every week. Holds nothing else. */
export const FEE_WALLET = process.env.NEXT_PUBLIC_FEE_WALLET || "";

export const LAUNCHPAD_PROGRAM = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";
export const LAUNCHLAB_AUTHORITY = "WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh";
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/**
 * The only fees. Raydium's 0.25% is charged by LaunchLab itself and cannot be removed. Candyfun's
 * platform fee is 0.1% (`feeRate` 1000 of 1,000,000) and all of it goes back to traders.
 */
export const RAYDIUM_FEE_PCT = 0.25;
export const PLATFORM_FEE_PCT = 0.1;
export const TRADER_FEE_PCT = RAYDIUM_FEE_PCT + PLATFORM_FEE_PCT;
/** In basis points, for curve quotes. */
export const TRADER_FEE_BPS = 35n;
/** After graduation the coin trades on a Raydium CPMM pool with this total fee. */
export const GRAD_FEE_PCT = 0.3;

/** No launch fee. The creator pays Solana rent and network fees straight to the chain. */
export const NETWORK_COST_SOL = Number(process.env.NEXT_PUBLIC_NETWORK_COST_SOL || "0.03");

/** Every coin starts at this market cap and graduates at START × MULTIPLE, whatever its pair. */
export const START_MCAP_USD = Number(process.env.NEXT_PUBLIC_START_MCAP_USD || "20000");
export const GRAD_MULTIPLE = Number(process.env.NEXT_PUBLIC_GRAD_MULTIPLE || "7.5");

/** The creator's optional first buy, in the same transaction as the launch. Capped, shown on the coin page. */
export const MAX_DEV_BUY_PCT = 5;

/** Weekly trader airdrop. Weeks start Monday 00:00 UTC. */
export const REWARDS = {
  topN: 100,
  botTradesPerHour: 300,
  minPayoutSol: 0.001,
};

/**
 * Anti-vamp fee. A ticker, name or launch tweet is free the first time. A copy pays this much SOL,
 * by the age of the coin it copies; all of it joins the weekly trader pot.
 */
export const VAMP_FEE_TIERS: { upToSec: number; sol: number; label: string }[] = [
  { upToSec: 15, sol: 5, label: "0–15 sec" },
  { upToSec: 60, sol: 4, label: "Up to 1 min" },
  { upToSec: 3600, sol: 3, label: "Up to 1 hour" },
  { upToSec: 6 * 3600, sol: 2, label: "Up to 6 hours" },
  { upToSec: Infinity, sol: 1, label: "After 6 hours" },
];

/** Bundle check window. */
export const BUNDLE_SLOTS = 20;
