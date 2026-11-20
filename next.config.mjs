/** @type {import('next').NextConfig} */
const csp = [
  "default-src 'self'",
  // Next.js needs inline scripts/styles; no third-party scripts are loaded at all. The dev server
  // (React Refresh) also needs eval; production builds do not.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
  // wallet-adapter's modal stylesheet @imports a Google Font.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Coin images live on Arweave (Irys gateway) and IPFS.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Browser talks only to our own API (RPC proxy included). Solflare's web wallet needs its connect iframe.
  "connect-src 'self' https://*.solflare.com",
  // Solflare web wallet + embedded DexScreener charts on token pages.
  "frame-src https://connect.solflare.com https://dexscreener.com https://platform.twitter.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Heavy ESM/native deps used only in nodejs API routes.
  experimental: { serverComponentsExternalPackages: ["@irys/upload", "@irys/upload-solana", "@irys/upload-core", "ioredis"] },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    config.externals = config.externals || [];
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
