# Candyfun

A memecoin launchpad that keeps nothing.

- Coins launch on **Raydium LaunchLab**, paired with any token Raydium has enabled for it (SOL, USDC, tokenized stocks, pre-IPO names, other memecoins…).
- A trade costs **0.35%**: 0.25% is Raydium's own protocol fee (built into LaunchLab, no launchpad can remove it) and **0.1%** is the platform fee.
- That 0.1% is not kept. Every Monday 00:00 UTC the whole pot is **airdropped in SOL to the top 100 wallets by volume** of the week, pro rata.
- No launch fee, no creator fee, no treasury, no platform token. The creator's own wallet creates the pool; there is no deployer in the middle.
- **Anti-vamp fee**: a ticker, name or launch tweet is free the first time. A copy pays, by the age of the coin it copies: 0–15 s 5 SOL · up to 1 min 4 SOL · up to 1 h 3 SOL · up to 6 h 2 SOL · after that 1 SOL. The fee goes to the trader pot.

There is no on-chain program here. Candyfun is one LaunchLab *platform config* (`feeRate` 1000 = 0.1%, creator fee 0, LP 100% burned at graduation), a Next.js site and a small keeper.

## How it is put together

```
app/            Next.js 14 pages and API routes
  api/launch    builds the unsigned launch transaction (initialize_v2 + optional vamp fee + optional first buy)
  api/trade     builds buys/sells on the curve (SOL is routed through the pair token with Jupiter)
  api/cron/tick one keeper tick, for hosts with a cron
lib/            curve sizing, launch + trade builders, anti-vamp, storage
keeper/         indexer, fee claim, weekly airdrop
  lib/payouts.mjs   the airdrop (plan is stored before anything is sent; safe to restart mid-payout)
  lib/indexer.mjs   trades → weekly volume per wallet, bot filter
  scripts/          keygen, create-platform, chain-check, sim-launch
```

**Launch flow.** The browser generates the mint keypair. `POST /api/launch` validates the coin, sizes the curve in USD (every coin starts at `START_MCAP_USD` whatever its pair), quotes the vamp fee, uploads metadata and returns an unsigned transaction. The wallet signs, then the mint keypair signs in the browser, and `POST /api/launch/submit` relays it. The server checks the signed message is byte-for-byte the one it built and lists the coin once its pool exists on-chain with the launcher as creator.

**Fee flow.** LaunchLab pays the platform fee into one vault per pair token. The keeper claims each vault into the pot, swaps non-SOL pots to SOL, and after each week ends pays the pot to that week's top 100 by volume. A creator's trades on their own coin don't count; wallets with more than 300 trades in an hour are left out for that week. Wash trading loses money by construction: it costs 0.35% of volume and the pot is 0.1% of it.

## What you are trusting

Coins, curves and liquidity are Raydium's programs; nothing here has authority over a coin. The trusted piece is the **fee wallet**: it is the platform's claim wallet and it sends the airdrop. Everything it does is in `keeper/` and on-chain, and every payout is listed on `/rewards`. The anti-vamp fee is enforced by the site (someone calling LaunchLab directly with this platform config skips it, and is simply not listed).

## Run it locally

```bash
npm install
cp .env.example .env.local   # set RPC_URL to a Helius URL
npm run dev                  # http://localhost:3900
```

With `KV_MEMORY=1` and `FAKE_UPLOADS=1` nothing external is needed. `POST /api/dev/seed` lists a few real LaunchLab pools so the pages have data. To run the keeper against the dev server's in-memory store:

```bash
KV_MEMORY=0 KV_HTTP=http://localhost:3900/api/dev/kv npm run keeper:dry
```

Checks that touch mainnet but send nothing:

```bash
npm run chain-check                                   # pairs enabled on LaunchLab, platform config simulates
node keeper/scripts/sim-launch.mjs <funded pubkey>    # builds launches through the server and simulates them
npm test                                              # airdrop maths
```

## Go live

1. `npm run keygen` writes `keys/platform-admin.json`, `keys/fee-wallet.json`, `keys/irys.json` (gitignored).
2. Send ~0.02 SOL to the admin, ~0.1 SOL to the fee wallet (network fees) and a little to the irys key (uploads).
3. `npm run platform` simulates; `npm run platform -- --send` creates the platform config and prints `NEXT_PUBLIC_PLATFORM_ID` / `NEXT_PUBLIC_FEE_WALLET`.
4. Deploy the site with Redis (`REDIS_URL`), `RPC_URL`, `FEE_WALLET_KEY`, `IRYS_KEY`, `CRON_SECRET`, and call `/api/cron/tick` every minute with `Authorization: Bearer $CRON_SECRET` (or run `npm run keeper` as a worker).

## Limits worth knowing

- Pairs are whatever Raydium enables for LaunchLab (663 tokens on 2026-11-20). Only Raydium can add one.
- Volume is counted on the bonding curve. After graduation a coin trades on Raydium CPMM at 0.30%; the platform's 0.05% creator share of that pool is pointed at the fee wallet but is not yet claimed by the keeper.
- A launch with the longest name, a first buy *and* a vamp fee does not fit in one transaction; the form asks to shorten one.

Memecoins are highly risky and most go to zero. Nothing here is financial advice.

## License

MIT
