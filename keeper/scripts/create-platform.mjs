// Create Candyfun's LaunchLab platform config (0.1% platform fee, no creator fee, LP 100% burned).
//   node keeper/scripts/create-platform.mjs          → simulate only, prints what would be created
//   node keeper/scripts/create-platform.mjs --send   → create it on mainnet (the admin pays ~0.006 SOL rent)
// Idempotent: if the platform already exists it is read back instead.
import { ComputeBudgetProgram, Connection, Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import { updatePlatformConfig } from "@raydium-io/raydium-sdk-v2";
import fs from "node:fs";
import path from "node:path";
import { LAUNCHPAD_PROGRAM, buildCreatePlatformIx, platformIdFor, readPlatform } from "../lib/launchlab.mjs";
import { loadEnv } from "../lib/env.mjs";

loadEnv();
const SEND = process.argv.includes("--send");
const conn = new Connection(process.env.RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
const load = (n) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "keys", `${n}.json`), "utf8"))));

const admin = load("platform-admin");
const fee = load("fee-wallet");
const WEB = process.env.NEXT_PUBLIC_SITE_URL || "https://candyfun.example";
const IMG = process.env.PLATFORM_IMG || `${WEB}/icon.png`;
const platformId = platformIdFor(admin.publicKey);

async function run(label, ix) {
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }), ix);
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = blockhash;
  if (!SEND) {
    const sim = await conn.simulateTransaction(new VersionedTransaction(tx.compileMessage()), { sigVerify: false, replaceRecentBlockhash: true });
    console.log(`${label}: simulate`, JSON.stringify(sim.value.err));
    if (sim.value.err) console.log((sim.value.logs || []).slice(-6).join("\n"));
    return;
  }
  tx.sign(admin);
  const sig = await conn.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
  const conf = await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  if (conf.value.err) throw new Error(`${label} failed: ${JSON.stringify(conf.value.err)}`);
  console.log(`${label}: ${sig}`);
}

console.log("admin     ", admin.publicKey.toBase58(), `(${(await conn.getBalance(admin.publicKey)) / 1e9} SOL)`);
console.log("fee wallet", fee.publicKey.toBase58());
console.log("platform  ", platformId.toBase58());

let live = await readPlatform(conn, platformId);
if (live) console.log("already live:", live);
else {
  await run("create platform", buildCreatePlatformIx({ admin: admin.publicKey, feeWallet: fee.publicKey, web: WEB, img: IMG }).ix);
  if (SEND) live = await readPlatform(conn, platformId);
}
// After graduation the CPMM pool's creator fee (0.05%) should reach the pot too.
if (live && live.platformCpCreator !== fee.publicKey.toBase58()) {
  await run("set CPMM creator → fee wallet", updatePlatformConfig(LAUNCHPAD_PROGRAM, admin.publicKey, platformId, { type: "updatePlatformCpCreator", value: fee.publicKey }));
}
console.log(`\nSet in .env.local / your host:\n  NEXT_PUBLIC_PLATFORM_ID=${platformId.toBase58()}\n  NEXT_PUBLIC_FEE_WALLET=${fee.publicKey.toBase58()}`);
