// Read-only checks against mainnet. Nothing is sent.
//   node keeper/scripts/chain-check.mjs
//   1. how many quote tokens Raydium has enabled for LaunchLab (the pairs a coin can launch against)
//   2. the Candyfun platform config (0.1%) simulates
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { LaunchpadConfig } from "@raydium-io/raydium-sdk-v2";
import { LAUNCHPAD_PROGRAM, buildCreatePlatformIx } from "../lib/launchlab.mjs";
import { loadEnv } from "../lib/env.mjs";

loadEnv();
const conn = new Connection(process.env.RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");

const span = LaunchpadConfig.span;
const accts = await conn.getProgramAccounts(LAUNCHPAD_PROGRAM, { filters: [{ dataSize: span }], dataSlice: { offset: 0, length: span } });
const quotes = new Map();
for (const a of accts) {
  try {
    const d = LaunchpadConfig.decode(a.account.data);
    quotes.set(d.mintB.toBase58(), { tradeFeeRate: d.tradeFeeRate.toString(), curveType: d.curveType, index: d.index });
  } catch {}
}
const rates = {};
for (const v of quotes.values()) rates[v.tradeFeeRate] = (rates[v.tradeFeeRate] || 0) + 1;
console.log(`global configs: ${accts.length} · distinct quote mints: ${quotes.size} · protocol fee rates:`, rates);

// Any funded account works as the simulated admin (SIM_PAYER): nothing is signed or sent.
if (!process.env.SIM_PAYER) {
  console.log("set SIM_PAYER=<any funded pubkey> to also simulate creating the platform config");
  process.exit(0);
}
const admin = { publicKey: new PublicKey(process.env.SIM_PAYER) };
const fee = Keypair.generate();
const { ix, platformId } = buildCreatePlatformIx({ admin: admin.publicKey, feeWallet: fee.publicKey, web: "https://candyfun.example", img: "https://candyfun.example/icon.png" });
const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }), ix);
tx.feePayer = admin.publicKey;
tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
const sim = await conn.simulateTransaction(new VersionedTransaction(tx.compileMessage()), { sigVerify: false, replaceRecentBlockhash: true });
console.log(`platform ${platformId.toBase58()} (feeRate 1000 = 0.1%) simulate:`, JSON.stringify(sim.value.err));
if (sim.value.err) console.log((sim.value.logs || []).slice(-6).join("\n"));
