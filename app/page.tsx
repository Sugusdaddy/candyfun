import Link from "next/link";
import { CoinMarket } from "@/components/CoinMarket";
import { PotBar } from "@/components/PotBar";
import { TRADER_FEE_PCT } from "@/lib/config";

export default function Home() {
  return (
    <div className="wrap">
      <div className="p-hero">
        <Link href="/create" className="bl p-start">
          start a new coin
        </Link>
        <div className="p-sub">
          pair it with any token on Raydium LaunchLab · {TRADER_FEE_PCT}% per trade, <b>0% kept by us</b> · open source
        </div>
        <PotBar />
      </div>
      <CoinMarket />
    </div>
  );
}
