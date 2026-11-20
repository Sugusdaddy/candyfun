// RPC access for the keeper. Reads that may touch version-1 transactions go through raw JSON-RPC
// (web3.js 1.x cannot parse them); sends go through web3.js. 429s retry, then fall back.
import { Connection, Keypair, PublicKey, Transaction, ComputeBudgetProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import bs58 from "bs58";
import fs from "node:fs";
import path from "node:path";
import { CFG } from "./config.mjs";

export const conn = new Connection(CFG.rpc, { commitment: "confirmed" });
const fallback = new Connection(CFG.rpcFallback, { commitment: "confirmed" });

export async function call(method, params, attempts = 6) {
  let last;
  for (let i = 0; i < attempts; i++) {
    const url = i >= attempts - 2 ? CFG.rpcFallback : CFG.rpc;
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      if (r.status === 429) throw new Error("429");
      const j = await r.json();
      if (j.error) throw new Error(`${method}: ${j.error.message || JSON.stringify(j.error)}`);
      return j.result;
    } catch (e) {
      last = e;
      await new Promise((res) => setTimeout(res, 400 * (i + 1)));
    }
  }
  throw last;
}

/** A transaction as plain JSON, any version. */
export const getTx = (sig) => call("getTransaction", [sig, { encoding: "json", commitment: "confirmed", maxSupportedTransactionVersion: 1 }]);

/** All account keys of a JSON transaction, lookups included, in index order. */
export function txKeys(tx) {
  const m = tx.transaction.message;
  return [...m.accountKeys, ...(tx.meta?.loadedAddresses?.writable || []), ...(tx.meta?.loadedAddresses?.readonly || [])];
}

function loadKey(env, name) {
  // Production: the env var. Local CLI runs (cwd = the repo root): fall back to keys/<name>.json (gitignored).
  let raw = process.env[env] || "";
  if (!raw && !process.env.VERCEL) {
    const file = path.resolve(process.cwd(), "keys", name);
    if (fs.existsSync(file)) raw = fs.readFileSync(file, "utf8");
  }
  if (!raw) return null;
  const s = raw.trim();
  return Keypair.fromSecretKey(s.startsWith("[") ? Uint8Array.from(JSON.parse(s)) : bs58.decode(s));
}
export const feeWallet = loadKey("FEE_WALLET_KEY", "fee-wallet.json");

export async function mintProgram(mint) {
  const ai = await conn.getAccountInfo(new PublicKey(mint));
  if (!ai) throw new Error("mint not found " + mint);
  return ai.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
}
export const ata = (owner, mint, program) => getAssociatedTokenAddressSync(new PublicKey(mint), new PublicKey(owner), true, program);

export async function tokenBalance(account) {
  try {
    return BigInt((await conn.getTokenAccountBalance(new PublicKey(account), "confirmed")).value.amount);
  } catch {
    return 0n;
  }
}

/** Send instructions signed by `signers[0]` (payer) and others, with retries on transient errors. */
export async function send(ixs, signers, { cu = 300_000, priority = 120_000, attempts = 4, onSigned = null } = {}) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const c = attempt > 2 ? fallback : conn;
    try {
      const bh = await c.getLatestBlockhash("confirmed");
      const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: cu }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priority }), ...ixs);
      tx.feePayer = signers[0].publicKey;
      tx.recentBlockhash = bh.blockhash;
      tx.sign(...signers);
      const sim = await c.simulateTransaction(tx);
      if (sim.value.err) throw new Error("sim " + JSON.stringify(sim.value.err) + " " + (sim.value.logs || []).slice(-3).join(" | "));
      // Callers that must never pay twice record the signature before it is sent.
      if (onSigned) await onSigned(bs58.encode(tx.signature));
      const sig = await c.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 3 });
      const conf = await c.confirmTransaction({ signature: sig, ...bh }, "confirmed");
      if (conf.value.err) throw new Error("failed " + JSON.stringify(conf.value.err));
      return sig;
    } catch (e) {
      last = e;
      if (!/429|blockhash|timeout|expired|node is behind|fetch failed/i.test(String(e.message))) throw e;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw last;
}
