import Link from "next/link";
import { FEE_WALLET, GITHUB_URL, GRAD_FEE_PCT, GRAD_MULTIPLE, MAX_DEV_BUY_PCT, PLATFORM_FEE_PCT, PLATFORM_ID, RAYDIUM_FEE_PCT, REWARDS, START_MCAP_USD, TRADER_FEE_PCT, VAMP_FEE_TIERS } from "@/lib/config";
import { usd } from "@/lib/format";

export const metadata = { title: "How it works" };

export default function HowPage() {
  const contracts: [string, string][] = [
    ["Raydium LaunchLab", "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj"],
    ["Raydium CPMM (after graduation)", "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"],
  ];
  if (PLATFORM_ID) contracts.push(["candyfun platform config (0.1%)", PLATFORM_ID]);
  if (FEE_WALLET) contracts.push(["fee wallet (holds the trader pot)", FEE_WALLET]);
  return (
    <div className="p-page">
      <Link href="/" className="bl">
        go back
      </Link>
      <h1>how it works</h1>
      <p>
        candyfun is a launchpad that keeps nothing. coins launch on Raydium LaunchLab against the token you pick, start at {usd(START_MCAP_USD, 0)} and
        graduate to a Raydium pool at {usd(START_MCAP_USD * GRAD_MULTIPLE, 0)}. the code is open source.
      </p>

      <h2>step 1: pick a pair</h2>
      <p>
        SOL, USDC, tokenized stocks (SPYx, NVDAx, TSLAx…), pre-IPO names, majors, memecoins, or <b>any token mint you paste</b>, as long as Raydium has
        enabled it for LaunchLab. that list is Raydium&apos;s (hundreds of tokens, growing); nobody but Raydium can add to it. buyers can always pay in
        SOL: the site routes through the pair in the same transaction.
      </p>

      <h2>step 2: your wallet creates the coin</h2>
      <p>
        no deployer, no launch fee, no payment to us. your wallet signs one transaction that creates the pool directly on Raydium, with you as creator.
        you pay Solana rent and network fees (about 0.03 SOL). supply is 1,000,000,000 with no mint or freeze authority. you can add a first buy in the
        same transaction, capped at {MAX_DEV_BUY_PCT}% of the supply and shown on the coin page.
      </p>

      <h2>step 3: it trades at {TRADER_FEE_PCT}%</h2>
      <p>
        <b>{RAYDIUM_FEE_PCT}%</b> is Raydium&apos;s own protocol fee: it is built into LaunchLab and no launchpad can remove it. <b>{PLATFORM_FEE_PCT}%</b> is
        candyfun&apos;s, and it all goes back to traders (below). no creator fee, no treasury, no token to buy back. after graduation the coin trades on
        Raydium at {GRAD_FEE_PCT}% and the LP tokens are burned.
      </p>

      <h2>step 4: every week the {PLATFORM_FEE_PCT}% is airdropped</h2>
      <p>
        every monday 00:00 UTC the whole pot is sent in SOL to the top {REWARDS.topN} wallets by volume of the week, pro rata. bots (more than{" "}
        {REWARDS.botTradesPerHour} trades in an hour) are left out. see the <Link href="/rewards" className="bl green">leaderboard</Link>.
      </p>

      <h2>no vamps, no pvp</h2>
      <p>
        a ticker, a name or a launch tweet is <b>free the first time</b>. launching a copy costs a vamp fee that depends on how old the coin you copy is.
        sniping a fresh ticker to split its volume is the expensive case. the fee is a plain transfer inside the copy&apos;s own launch transaction, and
        all of it joins the trader pot.
      </p>
      <table className="p-table" style={{ maxWidth: 360, margin: "8px 0 12px" }}>
        <tbody>
          {VAMP_FEE_TIERS.map((t) => (
            <tr key={t.label}>
              <td>{t.label}</td>
              <td className="r mono">{t.sol} SOL</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>lookalike tickers (PEPE, P3PE, PEPE2) and copied images are free but flagged on the coin page.</p>

      <h2>bundle check</h2>
      <p>
        every wallet that buys in the first 20 slots is traced back to who funded it. early buyers linked to the creator or to each other are flagged with
        the supply they still hold, and it all rolls into a grade from A to F on the coin page.
      </p>

      <h2>what you are trusting</h2>
      <p>
        coins, curves and liquidity are Raydium&apos;s programs: candyfun has no program and no authority over any coin. the one trusted piece is the fee
        wallet that claims the {PLATFORM_FEE_PCT}% and sends the airdrop; the keeper that runs it is in the repo, every payout is on-chain and listed on
        the leaderboard.{" "}
        {GITHUB_URL ? (
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="bl blue">
            read the code
          </a>
        ) : null}
      </p>

      <h2 id="contracts">contracts</h2>
      <table className="p-table">
        <tbody>
          {contracts.map(([k, v]) => (
            <tr key={k}>
              <td>{k}</td>
              <td className="r mono">
                <a href={`https://solscan.io/account/${v}`} target="_blank" rel="noreferrer">
                  {v.slice(0, 6)}…{v.slice(-6)} ↗
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 18 }}>memecoins are highly risky and most go to zero. nothing here is financial advice.</p>
      <Link href="/create" className="bl green p-start">
        start a new coin
      </Link>
    </div>
  );
}
