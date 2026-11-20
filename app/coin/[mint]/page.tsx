import type { Metadata } from "next";
import { CoinView } from "@/components/CoinView";
import { getCoin } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { mint: string } }): Promise<Metadata> {
  const c = await getCoin(params.mint).catch(() => null);
  if (!c) return { title: "Coin" };
  return {
    title: `$${c.ticker} · ${c.name}`,
    description: c.description || `$${c.ticker} on Candyfun, paired with ${c.pairSymbol}.`,
  };
}

export default function CoinPage({ params }: { params: { mint: string } }) {
  return <CoinView mint={params.mint} />;
}
