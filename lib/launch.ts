// The launch transaction. The creator's own wallet creates the pool on Raydium LaunchLab under
// Candyfun's platform config: no deployer in the middle, no payment to anyone, nothing custodial.
//
//   compute budget · initialize_v2 (creator = payer = the user) · [vamp fee if it copies a ticker] · [optional first buy]
//
// Signed by the creator and by the fresh mint keypair, which is generated in the creator's browser.
// The server only builds the unsigned transaction; it never holds a key that can sign it.
import { ComputeBudgetProgram, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
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
  getPdaMetadataKey,
  getPdaPlatformVault,
  initializeV2,
} from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import { SOL_MINT } from "./config";
import { DECIMALS, PROGRAM, globalConfigFor, poolIdFor, type Curve, type PoolView } from "./launchlab";
import { quoteBuy } from "./trade";

/** The pool as it will be right after creation, for quoting the first buy. */
export function freshPool(curve: Curve): PoolView {
  const S = curve.totalSellA, A = curve.migrateA, F = curve.totalFundRaisingB;
  return {
    virtualA: ((S * S) / (S - A)).toString(),
    virtualB: ((F * A) / (S - A)).toString(),
    realA: "0",
    realB: "0",
    totalSellA: S.toString(),
  } as PoolView;
}

export function buildLaunchTx(o: {
  creator: PublicKey;
  mint: PublicKey;
  quote: string;
  quoteProgram: PublicKey;
  platformId: string;
  curve: Curve;
  name: string;
  symbol: string;
  uri: string;
  blockhash: string;
  /** Raw pair-token amount the creator spends on the first buy (0 = none). */
  devBuyQuoteRaw: bigint;
  slippageBps?: number;
  /** Anti-vamp fee for copying a ticker/name/tweet, sent to the fee wallet (0 = original). */
  vampFeeLamports?: number;
  feeWallet?: string;
}): { tx: VersionedTransaction; poolId: PublicKey; devBuyOut: bigint } {
  const quote = new PublicKey(o.quote);
  const platform = new PublicKey(o.platformId);
  const poolId = poolIdFor(o.mint, quote);
  const auth = getPdaLaunchpadAuth(PROGRAM).publicKey;
  const vaultA = getPdaLaunchpadVaultId(PROGRAM, poolId, o.mint).publicKey;
  const vaultB = getPdaLaunchpadVaultId(PROGRAM, poolId, quote).publicKey;
  const config = globalConfigFor(quote);

  const ixs: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: o.devBuyQuoteRaw > 0n ? 520_000 : 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: Number(process.env.PRIORITY_MICROLAMPORTS || 150_000) }),
    initializeV2(
      PROGRAM,
      o.creator, // payer
      o.creator, // creator
      config,
      platform,
      auth,
      poolId,
      o.mint,
      quote,
      vaultA,
      vaultB,
      getPdaMetadataKey(o.mint).publicKey,
      o.quoteProgram,
      DECIMALS,
      o.name,
      o.symbol,
      o.uri,
      {
        type: "ConstantCurve",
        supply: new BN(o.curve.supply.toString()),
        totalSellA: new BN(o.curve.totalSellA.toString()),
        totalFundRaisingB: new BN(o.curve.totalFundRaisingB.toString()),
        migrateType: "cpmm",
      },
      new BN(0), // nothing locked or vested: the whole supply is on the curve or migrates
      new BN(0),
      new BN(0),
      0 as any // CPMM creator fee in the quote token only
    ),
  ];

  if (o.vampFeeLamports && o.vampFeeLamports > 0) {
    if (!o.feeWallet) throw new Error("Fee wallet not configured");
    ixs.push(SystemProgram.transfer({ fromPubkey: o.creator, toPubkey: new PublicKey(o.feeWallet), lamports: o.vampFeeLamports }));
  }

  let devBuyOut = 0n;
  if (o.devBuyQuoteRaw > 0n) {
    const q = quoteBuy(freshPool(o.curve), o.devBuyQuoteRaw);
    if (q.out <= 0n) throw new Error("First buy is too small");
    devBuyOut = q.out;
    const minOut = (q.out * BigInt(10_000 - (o.slippageBps ?? 100))) / 10_000n;
    const userA = getAssociatedTokenAddressSync(o.mint, o.creator, true, TOKEN_PROGRAM_ID);
    const userB = getAssociatedTokenAddressSync(quote, o.creator, true, o.quoteProgram);
    const isSol = o.quote === SOL_MINT;
    if (isSol) {
      ixs.push(
        createAssociatedTokenAccountIdempotentInstruction(o.creator, userB, o.creator, NATIVE_MINT, TOKEN_PROGRAM_ID),
        SystemProgram.transfer({ fromPubkey: o.creator, toPubkey: userB, lamports: Number(o.devBuyQuoteRaw) }),
        createSyncNativeInstruction(userB, TOKEN_PROGRAM_ID)
      );
    }
    ixs.push(
      createAssociatedTokenAccountIdempotentInstruction(o.creator, userA, o.creator, o.mint, TOKEN_PROGRAM_ID),
      buyExactInInstruction(
        PROGRAM, o.creator, auth, config, platform, poolId, userA, userB, vaultA, vaultB, o.mint, quote,
        TOKEN_PROGRAM_ID, o.quoteProgram,
        getPdaPlatformVault(PROGRAM, platform, quote).publicKey,
        getPdaCreatorVault(PROGRAM, o.creator, quote).publicKey,
        new BN(o.devBuyQuoteRaw.toString()), new BN(minOut.toString())
      )
    );
    if (isSol) ixs.push(createCloseAccountInstruction(userB, o.creator, o.creator, [], TOKEN_PROGRAM_ID));
  }

  const msg = new TransactionMessage({ payerKey: o.creator, recentBlockhash: o.blockhash, instructions: ixs }).compileToV0Message();
  return { tx: new VersionedTransaction(msg), poolId, devBuyOut };
}
