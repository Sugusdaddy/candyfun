// Claim the platform fee vaults (one per pair token) into the weekly trader pot.
//
// Candyfun's 0.1% accrues in a LaunchLab vault per (platform, pair token). Whatever is claimed goes,
// whole, into the pot of that pair token; nothing is split off for anyone else. Per-coin totals are
// kept only for display, in the proportions the indexer attributed trade by trade. A SOL claim is
// unwrapped in the same transaction, so the SOL pot is plain lamports in the fee wallet.
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, createCloseAccountInstruction } from "@solana/spl-token";
import { claimPlatformFeeFromVault, getPdaPlatformFeeVaultAuth } from "@raydium-io/raydium-sdk-v2";
import { CFG, SOL_MINT } from "./config.mjs";
import { K, hashObj, kv } from "./kv.mjs";
import { LAUNCHPAD_PROGRAM } from "./launchlab.mjs";
import { ata, feeWallet, mintProgram, send, tokenBalance } from "./solana.mjs";
import { platformVaultOf } from "./indexer.mjs";

export async function claimToPot(coins, prices, log) {
  const groups = new Map();
  for (const c of coins) {
    const vault = platformVaultOf(c);
    if (!groups.has(vault)) groups.set(vault, { vault, platformId: c.platformId, quote: c.pair, symbol: c.pairSymbol, dec: c.pairDecimals ?? 9, coins: [] });
    groups.get(vault).coins.push(c);
  }
  for (const g of groups.values()) {
    const bal = await tokenBalance(g.vault);
    const usd = (Number(bal) / 10 ** g.dec) * (prices[g.quote] || 0);
    if (bal <= 0n || usd < CFG.minClaimUsd) continue;
    const attr = hashObj(await kv(["HGETALL", K.feeAttr(g.vault)]));
    log(`claim ${g.symbol} vault ${g.vault.slice(0, 6)}: ${Number(bal) / 10 ** g.dec} (~$${usd.toFixed(2)})`);
    if (CFG.dry || !feeWallet) continue;

    const program = await mintProgram(g.quote);
    const isSol = g.quote === SOL_MINT;
    const recipient = ata(feeWallet.publicKey, g.quote, program);
    const before = isSol ? 0n : await tokenBalance(recipient);
    const ixs = [
      createAssociatedTokenAccountIdempotentInstruction(feeWallet.publicKey, recipient, feeWallet.publicKey, new PublicKey(g.quote), program),
      claimPlatformFeeFromVault(
        LAUNCHPAD_PROGRAM,
        new PublicKey(g.platformId),
        feeWallet.publicKey,
        getPdaPlatformFeeVaultAuth(LAUNCHPAD_PROGRAM).publicKey,
        new PublicKey(g.vault),
        recipient,
        new PublicKey(g.quote),
        program
      ),
    ];
    if (isSol) ixs.push(createCloseAccountInstruction(recipient, feeWallet.publicKey, feeWallet.publicKey, [], TOKEN_PROGRAM_ID));
    const sig = await send(ixs, [feeWallet]);
    const claimed = isSol ? bal : (await tokenBalance(recipient)) - before || bal;
    log(`  claimed ${claimed} raw · ${sig}`);

    await kv(["HINCRBY", K.quoteLedger(g.quote), "pot", claimed.toString()]);
    await kv(["HINCRBYFLOAT", K.stats, "feesUsd", usd.toFixed(4)]);
    // Display only: which coins earned it.
    const weights = g.coins.map((c) => [c.mint, BigInt(attr[c.mint] || "0")]).filter(([, w]) => w > 0n);
    const total = weights.reduce((a, [, w]) => a + w, 0n);
    for (const [mint, w] of weights) {
      await kv(["HINCRBYFLOAT", K.rewards(mint), "fees", (Number((claimed * w) / total) / 10 ** g.dec).toFixed(9)]);
      await kv(["HINCRBY", K.feeAttr(g.vault), mint, (-w).toString()]);
    }
  }
}
