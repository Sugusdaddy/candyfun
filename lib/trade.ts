// Trades on a coin's LaunchLab curve, built server-side and signed by the user's wallet.
//
// A coin paired with SOL trades in SOL. A coin paired with anything else (USDC, NVDAx, PEAK…) can be
// traded with that token directly, or with SOL: the transaction routes SOL ⇄ pair token through
// Jupiter and the curve in one go, so the user never has to hold the pair token (as Peak does).
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  buyExactInInstruction,
  getPdaCreatorVault,
  getPdaLaunchpadAuth,
  getPdaLaunchpadVaultId,
  getPdaPlatformVault,
  sellExactInInstruction,
} from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import { SOL_MINT, TRADER_FEE_BPS } from "./config";
import { PROGRAM, globalConfigFor, type PoolView } from "./launchlab";

const JUP = "https://lite-api.jup.ag/swap/v1";

/** What a trade pays on the curve: Raydium 0.25% + the 0.1% that goes back to traders. */
const FEE = TRADER_FEE_BPS;

/** Tokens out for `quoteIn` raw of the pair token. The fee comes off the way in. */
export function quoteBuy(pool: PoolView, quoteIn: bigint): { out: bigint; impact: number } {
  const vA = BigInt(pool.virtualA), vB = BigInt(pool.virtualB), rA = BigInt(pool.realA), rB = BigInt(pool.realB);
  const net = (quoteIn * (10_000n - FEE)) / 10_000n;
  if (net <= 0n) return { out: 0n, impact: 0 };
  const left = vA - rA;
  const inQ = vB + rB;
  let out = left - (left * inQ) / (inQ + net);
  const sellable = BigInt(pool.totalSellA) - rA;
  if (out > sellable) out = sellable;
  if (out <= 0n) return { out: 0n, impact: 0 };
  const spot = Number(inQ) / Number(left);
  return { out, impact: Math.max(0, Number(net) / Number(out) / spot - 1) };
}

/** Pair-token raw out for `tokensIn` raw, fee taken off the way out. */
export function quoteSell(pool: PoolView, tokensIn: bigint): { out: bigint; impact: number } {
  const vA = BigInt(pool.virtualA), vB = BigInt(pool.virtualB), rA = BigInt(pool.realA), rB = BigInt(pool.realB);
  if (tokensIn <= 0n) return { out: 0n, impact: 0 };
  const left = vA - rA;
  const inQ = vB + rB;
  let gross = inQ - (left * inQ) / (left + tokensIn);
  if (gross > rB) gross = rB;
  if (gross <= 0n) return { out: 0n, impact: 0 };
  const out = (gross * (10_000n - FEE)) / 10_000n;
  const spot = Number(inQ) / Number(left);
  return { out, impact: Math.max(0, 1 - Number(gross) / Number(tokensIn) / spot) };
}

function accounts(pool: PoolView, mint: PublicKey, owner: PublicKey, quoteProgram: PublicKey) {
  const poolId = new PublicKey(pool.poolId);
  const quote = new PublicKey(pool.quoteMint);
  return {
    poolId,
    quote,
    auth: getPdaLaunchpadAuth(PROGRAM).publicKey,
    config: globalConfigFor(quote),
    platformId: new PublicKey(pool.platformId),
    vaultA: getPdaLaunchpadVaultId(PROGRAM, poolId, mint).publicKey,
    vaultB: getPdaLaunchpadVaultId(PROGRAM, poolId, quote).publicKey,
    userA: getAssociatedTokenAddressSync(mint, owner, true, TOKEN_PROGRAM_ID),
    userB: getAssociatedTokenAddressSync(quote, owner, true, quoteProgram),
    platformVault: getPdaPlatformVault(PROGRAM, new PublicKey(pool.platformId), quote).publicKey,
    creatorVault: getPdaCreatorVault(PROGRAM, new PublicKey(pool.creator), quote).publicKey,
  };
}

type JupIx = { programId: string; accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[]; data: string };
const toIx = (i: JupIx) =>
  new TransactionInstruction({
    programId: new PublicKey(i.programId),
    keys: i.accounts.map((a) => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
    data: Buffer.from(i.data, "base64"),
  });

async function jupiter(owner: PublicKey, inputMint: string, outputMint: string, amount: bigint, slippageBps: number) {
  const q = await fetch(`${JUP}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&restrictIntermediateTokens=true`, { cache: "no-store" });
  if (!q.ok) throw new Error("No route between SOL and the pair token right now");
  const quote = await q.json();
  if (!quote?.outAmount) throw new Error("No route between SOL and the pair token right now");
  const r = await fetch(`${JUP}/swap-instructions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ quoteResponse: quote, userPublicKey: owner.toBase58(), wrapAndUnwrapSol: true, dynamicComputeUnitLimit: false }),
    cache: "no-store",
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error("Jupiter: " + (j.error || r.status));
  return { quote, j };
}

async function luts(conn: Connection, addrs: string[]): Promise<AddressLookupTableAccount[]> {
  if (!addrs.length) return [];
  const infos = await conn.getMultipleAccountsInfo(addrs.map((a) => new PublicKey(a)));
  return infos
    .map((ai, i) => (ai ? new AddressLookupTableAccount({ key: new PublicKey(addrs[i]), state: AddressLookupTableAccount.deserialize(ai.data) }) : null))
    .filter(Boolean) as AddressLookupTableAccount[];
}

export type BuiltTrade = { tx: string; expectedOut: string; minOut: string; impact: number; route: "direct" | "sol" };

/**
 * Buy: spend `amountIn` raw of SOL (payWith "sol") or of the pair token (payWith "pair").
 * Sell: sell `amountIn` raw tokens, receive SOL ("sol") or the pair token ("pair").
 */
export async function buildTrade(o: {
  conn: Connection;
  pool: PoolView;
  mint: string;
  owner: string;
  side: "buy" | "sell";
  amountIn: bigint;
  payWith: "sol" | "pair";
  slippageBps: number;
  quoteProgram: PublicKey;
}): Promise<BuiltTrade> {
  const { conn, pool, side, slippageBps } = o;
  const owner = new PublicKey(o.owner);
  const mint = new PublicKey(o.mint);
  const a = accounts(pool, mint, owner, o.quoteProgram);
  const isSolPair = pool.quoteMint === SOL_MINT;
  const viaJup = o.payWith === "sol" && !isSolPair;
  const ixs: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: viaJup ? 600_000 : 250_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: Number(process.env.PRIORITY_MICROLAMPORTS || 150_000) }),
  ];
  let lookups: string[] = [];
  const slip = (x: bigint) => (x * BigInt(10_000 - slippageBps)) / 10_000n;

  if (side === "buy") {
    let quoteIn = o.amountIn;
    if (viaJup) {
      const { quote, j } = await jupiter(owner, SOL_MINT, pool.quoteMint, o.amountIn, slippageBps);
      ixs.push(...(j.setupInstructions || []).map(toIx), toIx(j.swapInstruction));
      if (j.cleanupInstruction) ixs.push(toIx(j.cleanupInstruction));
      lookups = j.addressLookupTableAddresses || [];
      quoteIn = BigInt(quote.otherAmountThreshold); // what the swap guarantees
    }
    const q = quoteBuy(pool, quoteIn);
    if (q.out <= 0n) throw new Error("Amount too small");
    if (isSolPair) {
      ixs.push(
        createAssociatedTokenAccountIdempotentInstruction(owner, a.userB, owner, NATIVE_MINT, TOKEN_PROGRAM_ID),
        SystemProgram.transfer({ fromPubkey: owner, toPubkey: a.userB, lamports: Number(quoteIn) }),
        createSyncNativeInstruction(a.userB, TOKEN_PROGRAM_ID)
      );
    }
    ixs.push(
      createAssociatedTokenAccountIdempotentInstruction(owner, a.userA, owner, mint, TOKEN_PROGRAM_ID),
      buyExactInInstruction(
        PROGRAM, owner, a.auth, a.config, a.platformId, a.poolId, a.userA, a.userB, a.vaultA, a.vaultB, mint, a.quote,
        TOKEN_PROGRAM_ID, o.quoteProgram, a.platformVault, a.creatorVault, new BN(quoteIn.toString()), new BN(slip(q.out).toString())
      )
    );
    if (isSolPair) ixs.push(createCloseAccountInstruction(a.userB, owner, owner, [], TOKEN_PROGRAM_ID));
    return finish(conn, owner, ixs, lookups, q.out, slip(q.out), q.impact, viaJup);
  }

  // sell
  const q = quoteSell(pool, o.amountIn);
  if (q.out <= 0n) throw new Error("Amount too small");
  const minQuote = slip(q.out);
  ixs.push(
    createAssociatedTokenAccountIdempotentInstruction(owner, a.userB, owner, a.quote, o.quoteProgram),
    sellExactInInstruction(
      PROGRAM, owner, a.auth, a.config, a.platformId, a.poolId, a.userA, a.userB, a.vaultA, a.vaultB, mint, a.quote,
      TOKEN_PROGRAM_ID, o.quoteProgram, a.platformVault, a.creatorVault, new BN(o.amountIn.toString()), new BN(minQuote.toString())
    )
  );
  let expected = q.out;
  let min = minQuote;
  if (isSolPair) ixs.push(createCloseAccountInstruction(a.userB, owner, owner, [], TOKEN_PROGRAM_ID));
  else if (viaJup) {
    const { quote, j } = await jupiter(owner, pool.quoteMint, SOL_MINT, minQuote, slippageBps);
    ixs.push(...(j.setupInstructions || []).map(toIx), toIx(j.swapInstruction));
    if (j.cleanupInstruction) ixs.push(toIx(j.cleanupInstruction));
    lookups = j.addressLookupTableAddresses || [];
    expected = BigInt(quote.outAmount);
    min = BigInt(quote.otherAmountThreshold);
  }
  return finish(conn, owner, ixs, lookups, expected, min, q.impact, viaJup);
}

async function finish(conn: Connection, owner: PublicKey, ixs: TransactionInstruction[], lookups: string[], expected: bigint, min: bigint, impact: number, viaJup: boolean): Promise<BuiltTrade> {
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const msg = new TransactionMessage({ payerKey: owner, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message(await luts(conn, lookups));
  const tx = new VersionedTransaction(msg);
  return { tx: Buffer.from(tx.serialize()).toString("base64"), expectedOut: expected.toString(), minOut: min.toString(), impact, route: viaJup ? "sol" : "direct" };
}
