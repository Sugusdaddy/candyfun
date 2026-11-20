import Link from "next/link";
import { Leaderboard } from "@/components/Leaderboard";
import { PLATFORM_FEE_PCT, REWARDS } from "@/lib/config";

export const metadata = { title: "Weekly airdrop" };

export default function RewardsPage() {
  return (
    <div className="p-page">
      <Link href="/" className="bl">
        go back
      </Link>
      <h1>weekly airdrop</h1>
      <p>
        candyfun&apos;s whole cut is <b>{PLATFORM_FEE_PCT}% per trade</b>, and none of it is kept. every monday 00:00 UTC the pot is paid in SOL to the{" "}
        <b>top {REWARDS.topN} wallets by volume</b> of the week that just ended, in proportion to their volume. nothing to claim: it lands in your wallet.
        vamp fees join the same pot.
      </p>
      <p>
        trades from any terminal count. a creator&apos;s trades on their own coin don&apos;t. wallets with more than {REWARDS.botTradesPerHour} trades in an hour are
        left out for that week. wash trading loses money by design: it costs 0.35% of the volume and the pot is only 0.1% of it.
      </p>
      <div style={{ height: 10 }} />
      <Leaderboard />
    </div>
  );
}
