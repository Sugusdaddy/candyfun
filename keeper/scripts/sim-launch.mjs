// Build launch transactions through a running web server and SIMULATE them on mainnet.
// Nothing is signed or sent: the payer only has to be a funded address.
//   node keeper/scripts/sim-launch.mjs <payer pubkey> [site=http://localhost:3900]
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { loadEnv } from "../lib/env.mjs";

loadEnv();
const payer = process.argv[2];
const site = process.argv[3] || "http://localhost:3900";
if (!payer) throw new Error("usage: sim-launch.mjs <payer pubkey> [site]");
const conn = new Connection(process.env.RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const SOL = "So11111111111111111111111111111111111111112";
const tag = Math.random().toString(36).slice(2, 7).toUpperCase();

async function launch(label, body) {
  const mint = Keypair.generate().publicKey.toBase58();
  const r = await fetch(`${site}/api/launch`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ payer, mint, image: PNG, description: "simulation", ...body }) });
  const j = await r.json();
  if (!r.ok) return console.log(`${label}: HTTP ${r.status} · ${j.error}${j.vampFeeSol ? ` · vampFeeSol=${j.vampFeeSol}` : ""}`), j;
  const tx = VersionedTransaction.deserialize(Buffer.from(j.tx, "base64"));
  const sim = await conn.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true });
  console.log(`${label}: ${Buffer.from(j.tx, "base64").length} bytes · vamp ${j.vampFeeSol} SOL · devBuyOut ${j.devBuyOut} · simulate ${JSON.stringify(sim.value.err)} · ${sim.value.unitsConsumed} CU`);
  if (sim.value.err) console.log((sim.value.logs || []).slice(-8).join("\n"));
  await fetch(`${site}/api/launch?id=${j.launchId}`, { method: "DELETE" });
  return j;
}

await launch("SOL pair, no buy       ", { name: `Sim ${tag}`, ticker: `S${tag}`, pair: SOL });
await launch("SOL pair, 0.2 SOL buy  ", { name: `Sim buy ${tag}`, ticker: `B${tag}`, pair: SOL, devBuyRaw: "200000000" });
await launch("USDC pair, no buy      ", { name: `Sim usdc ${tag}`, ticker: `U${tag}`, pair: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" });
await launch("NVDAx pair (Token-2022)", { name: `Sim nvda ${tag}`, ticker: `N${tag}`, pair: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh" });
await launch("longest name + buy     ", { name: "A".repeat(32), ticker: `L${tag}`.slice(0, 10), pair: SOL, devBuyRaw: "100000000", twitter: "", tweetUrl: "" });
// Anti-vamp: hold a ticker with a pending launch, then try to copy it.
const tk = `V${tag}`;
const mintA = Keypair.generate().publicKey.toBase58();
const a = await (await fetch(`${site}/api/launch`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ payer, mint: mintA, image: PNG, name: `Vamp ${tag}`, ticker: tk, pair: SOL }) })).json();
console.log("original reserved      :", a.launchId ? `ok, vamp ${a.vampFeeSol} SOL` : a.error);
await launch("copy, fee not accepted ", { name: `Other ${tag}`, ticker: tk, pair: SOL });
await launch("copy, 5 SOL accepted   ", { name: `Other2 ${tag}`, ticker: tk, pair: SOL, acceptVampFeeSol: 5 });
if (a.launchId) await fetch(`${site}/api/launch?id=${a.launchId}`, { method: "DELETE" });
await launch("after original cancels ", { name: `Other3 ${tag}`, ticker: tk, pair: SOL });
