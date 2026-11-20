// Anti-vamp by price, not by ban.
//
// The first coin to use a ticker, a name or a launch tweet launches free. Anyone who launches a copy
// pays a vamp fee that depends on how old the coin being copied is:
//
//   0–15 s: 5 SOL · up to 1 min: 4 SOL · up to 1 h: 3 SOL · up to 6 h: 2 SOL · after 6 h: 1 SOL
//
// The fee is a plain SOL transfer inside the copy's own launch transaction, to the fee wallet, and
// all of it joins the weekly trader pot. Sniping a fresh ticker to split its volume (PvP) is the
// expensive case; reusing an old ticker stays possible but never free.
//
// Check-and-take runs behind one Redis mutex, so two people pressing launch at the same instant
// produce exactly one free launch: the other one is quoted the 5 SOL tier.
import crypto from "node:crypto";
import { VAMP_FEE_TIERS } from "./config";
import { K, kv } from "./kv";

export type LockKind = "ticker" | "name" | "tweet";
/** `mint` is set once the coin is live; before that the lock is a short reservation. */
type LockValue = { launchId: string; mint?: string; at: number; until: number; ticker: string };

export const normTicker = (t: string) => t.trim().toUpperCase().replace(/^\$/, "");
export const normName = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "");
export function tweetId(url: string): string | null {
  const m = /(?:x|twitter)\.com\/[^/]+\/status(?:es)?\/(\d{5,25})/i.exec(url || "");
  return m ? m[1] : null;
}

/** Fold a ticker so lookalikes collide: P3PE, PEPE2 and PEPE all fold to PEPE. */
export function foldTicker(t: string): string {
  const map: Record<string, string> = { "0": "O", "1": "I", "3": "E", "4": "A", "5": "S", "7": "T", "8": "B", "@": "A", "$": "S" };
  const s = normTicker(t).replace(/\d+$/, (d) => (d.length === t.length ? d : ""));
  return s.split("").map((c) => map[c] || c).join("").replace(/(.)\1+/g, "$1");
}

export const imageHash = (buf: Buffer) => crypto.createHash("sha256").update(buf).digest("hex");

type Input = { ticker: string; name: string; tweetUrl?: string | null };

function keysFor(input: Input): { kind: LockKind; key: string }[] {
  const out: { kind: LockKind; key: string }[] = [
    { kind: "ticker", key: normTicker(input.ticker) },
    { kind: "name", key: normName(input.name) },
  ];
  const tid = input.tweetUrl ? tweetId(input.tweetUrl) : null;
  if (tid) out.push({ kind: "tweet", key: tid });
  return out.filter((k) => k.key);
}

/** The vamp fee in SOL for copying something that launched `ageMs` ago. */
export function feeForAge(ageMs: number): number {
  for (const t of VAMP_FEE_TIERS) if (ageMs <= t.upToSec * 1000) return t.sol;
  return VAMP_FEE_TIERS[VAMP_FEE_TIERS.length - 1].sol;
}

export type VampQuote = {
  /** 0 when the ticker, name and tweet are all unused. */
  sol: number;
  kind: LockKind | null;
  /** The coin being copied (absent while the original is still a pending reservation). */
  mint?: string;
  ticker?: string;
  ageSec?: number;
};

/** What launching this would cost in vamp fee right now. `selfLaunchId` ignores our own reservation. */
export async function vampQuote(input: Input, selfLaunchId?: string): Promise<VampQuote> {
  let best: VampQuote = { sol: 0, kind: null };
  const now = Date.now();
  for (const { kind, key } of keysFor(input)) {
    const raw = await kv(["GET", K.lock(kind, key)]);
    if (!raw) continue;
    const v = JSON.parse(raw) as LockValue;
    if (selfLaunchId && v.launchId === selfLaunchId) continue;
    // A reservation that never became a coin and ran out is nothing.
    if (!v.mint && v.until <= now) continue;
    const age = Math.max(0, now - (v.at || 0));
    const sol = v.mint ? feeForAge(age) : VAMP_FEE_TIERS[0].sol;
    if (sol > best.sol) best = { sol, kind, mint: v.mint, ticker: v.ticker, ageSec: Math.floor(age / 1000) };
  }
  return best;
}

async function withMutex<T>(fn: () => Promise<T>): Promise<T> {
  const token = crypto.randomBytes(8).toString("hex");
  const deadline = Date.now() + 8000;
  while ((await kv(["SET", K.vampMutex, token, "NX", "EX", 10])) !== "OK") {
    if (Date.now() > deadline) throw new Error("Launch queue is busy, try again in a moment");
    await new Promise((r) => setTimeout(r, 120));
  }
  try {
    return await fn();
  } finally {
    if ((await kv(["GET", K.vampMutex])) === token) await kv(["DEL", K.vampMutex]);
  }
}

/**
 * Quote the vamp fee and, for anything still unused, take a short reservation so a second launcher
 * in the same instant is quoted as a copy. Locks that already belong to a live coin are left alone:
 * they only move to this launch if it actually lands (see `confirmLocks`).
 */
export async function reserve(launchId: string, input: Input, holdSec = 120): Promise<VampQuote> {
  return withMutex(async () => {
    const quote = await vampQuote(input, launchId);
    const now = Date.now();
    for (const { kind, key } of keysFor(input)) {
      const raw = await kv(["GET", K.lock(kind, key)]);
      const cur = raw ? (JSON.parse(raw) as LockValue) : null;
      const taken = cur && (cur.mint || cur.until > now) && cur.launchId !== launchId;
      if (taken) continue;
      const v: LockValue = { launchId, at: now, until: now + holdSec * 1000, ticker: normTicker(input.ticker) };
      await kv(["SET", K.lock(kind, key), JSON.stringify(v)]);
    }
    return quote;
  });
}

/** The coin is live: its ticker, name and tweet now point at it, and the vamp clock restarts. */
export async function confirmLocks(launchId: string, mint: string, input: Input) {
  const now = Date.now();
  const v: LockValue = { launchId, mint, at: now, until: now, ticker: normTicker(input.ticker) };
  for (const { kind, key } of keysFor(input)) await kv(["SET", K.lock(kind, key), JSON.stringify(v)]);
}

/** A launch that failed or was cancelled gives its reservation back. */
export async function release(launchId: string, input: Input) {
  for (const { kind, key } of keysFor(input)) {
    const raw = await kv(["GET", K.lock(kind, key)]);
    if (!raw) continue;
    const v = JSON.parse(raw) as LockValue;
    if (v.launchId === launchId && !v.mint) await kv(["DEL", K.lock(kind, key)]);
  }
}

export function describeQuote(q: VampQuote): string {
  if (!q.sol) return "";
  const what = q.kind === "tweet" ? "That launch tweet" : q.kind === "name" ? "That name" : `$${q.ticker}`;
  if (!q.mint) return `${what} is being launched right now. Launching a copy costs ${q.sol} SOL.`;
  const s = q.ageSec || 0;
  const age = s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min` : s < 86400 ? `${Math.floor(s / 3600)} h` : `${Math.floor(s / 86400)} d`;
  return `${what} already launched ${age} ago. Launching a copy costs ${q.sol} SOL (vamp fee, paid to traders).`;
}

/** After launch: record the folded ticker and the image, and return what this coin should be flagged for. */
export async function recordAndFlag(mint: string, ticker: string, imgSha: string): Promise<{ lookalikeOf: string[]; sameImageAs: string | null }> {
  const fold = foldTicker(ticker);
  const raw = await kv(["HGET", K.fold, fold]);
  const prev: { mint: string; ticker: string; at: number }[] = raw ? JSON.parse(raw) : [];
  const recent = prev.filter((p) => p.at > Date.now() - 30 * 86400_000 && p.mint !== mint);
  const lookalikeOf = recent.filter((p) => normTicker(p.ticker) !== normTicker(ticker)).map((p) => p.mint);
  await kv(["HSET", K.fold, fold, JSON.stringify([...recent, { mint, ticker: normTicker(ticker), at: Date.now() }].slice(-20))]);
  const first = await kv(["GET", K.image(imgSha)]);
  if (!first) await kv(["SET", K.image(imgSha), mint]);
  return { lookalikeOf, sameImageAs: first && first !== mint ? first : null };
}
