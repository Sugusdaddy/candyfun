"use client";

import Link from "next/link";
import { GITHUB_URL, X_URL } from "@/lib/config";
import { WalletButton } from "./WalletButton";
import { Logo } from "./Logo";
import { Bubbles } from "./LiveStrip";

export function Nav() {
  return (
    <header className="p-nav">
      <div className="links">
        <Link href="/" aria-label="Candyfun home">
          <Logo />
        </Link>
        <Link href="/how" className="bl">
          how it works
        </Link>
        <Link href="/rewards" className="bl green">
          weekly airdrop
        </Link>
        {GITHUB_URL ? (
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="bl">
            source code
          </a>
        ) : null}
        {X_URL ? (
          <a href={X_URL} target="_blank" rel="noreferrer" className="bl">
            twitter
          </a>
        ) : null}
      </div>
      <div className="right">
        <Bubbles />
        <WalletButton />
      </div>
    </header>
  );
}
