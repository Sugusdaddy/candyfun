import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ToastHost } from "@/components/Toast";
import { SITE_TAGLINE, SITE_URL } from "@/lib/config";

const sans = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Candyfun · the launchpad that keeps nothing", template: "%s · Candyfun" },
  description:
    "Launch a coin against any token Raydium LaunchLab supports. 0.35% per trade: 0.25% is Raydium's, the other 0.1% is airdropped every week to the top traders by volume. Open source.",
  openGraph: { title: "Candyfun", description: SITE_TAGLINE, siteName: "Candyfun", type: "website" },
  twitter: { card: "summary_large_image", title: "Candyfun", description: SITE_TAGLINE },
};

export const viewport: Viewport = { themeColor: "#1b1d28" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <Nav />
          <main>{children}</main>
          <Footer />
          <ToastHost />
        </Providers>
      </body>
    </html>
  );
}
