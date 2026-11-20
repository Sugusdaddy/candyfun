import Link from "next/link";
import { GITHUB_URL, LAUNCHPAD_PROGRAM, PLATFORM_ID, X_URL } from "@/lib/config";

export function Footer() {
  return (
    <footer className="footer">
      <div className="links">
        <Link href="/how" className="bl">
          how it works
        </Link>
        <Link href="/rewards" className="bl">
          weekly airdrop
        </Link>
        <a href={`https://solscan.io/account/${PLATFORM_ID || LAUNCHPAD_PROGRAM}`} target="_blank" rel="noreferrer" className="bl">
          on-chain
        </a>
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
      Candyfun keeps nothing. Open source, MIT. Memecoins are highly risky and most go to zero. Nothing here is financial advice.
    </footer>
  );
}
