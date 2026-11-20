// Shortcuts shown in the launch form. A coin can pair with ANY token Raydium has enabled for
// LaunchLab (663 quote mints on 2026-11-20, `node keeper/scripts/chain-check.mjs` counts them):
// the rest are pasted by mint address under "any token".
export type Pair = { mint: string; symbol: string; name: string; group: "crypto" | "stocks" | "preipo"; decimals: number; token2022?: boolean };

export const PAIRS: Pair[] = [
  { mint: "So11111111111111111111111111111111111111112", symbol: "SOL", name: "Solana", group: "crypto", decimals: 9 },
  { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", name: "USD Coin", group: "crypto", decimals: 6 },
  { mint: "USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB", symbol: "USD1", name: "World Liberty USD", group: "crypto", decimals: 6 },
  { mint: "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij", symbol: "cbBTC", name: "Bitcoin", group: "crypto", decimals: 8 },
  { mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", symbol: "WETH", name: "Ether", group: "crypto", decimals: 8 },
  { mint: "98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g", symbol: "HYPE", name: "Hyperliquid", group: "crypto", decimals: 9 },
  { mint: "A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS", symbol: "ZEC", name: "Zcash", group: "crypto", decimals: 8 },
  { mint: "WXMRyRZhsa19ety5erZhHg4N3xj3EVN92u94422teJp", symbol: "XMR", name: "Monero", group: "crypto", decimals: 12 },
  { mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", symbol: "RAY", name: "Raydium", group: "crypto", decimals: 6 },
  { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP", name: "Jupiter", group: "crypto", decimals: 6 },
  { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", name: "Bonk", group: "crypto", decimals: 5 },
  { mint: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn", symbol: "PUMP", name: "Pump", group: "crypto", decimals: 6, token2022: true },
  { mint: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN", symbol: "TRUMP", name: "Official Trump", group: "crypto", decimals: 6 },
  { mint: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv", symbol: "PENGU", name: "Pudgy Penguins", group: "crypto", decimals: 6 },
  { mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", symbol: "FARTCOIN", name: "Fartcoin", group: "crypto", decimals: 6 },
  { mint: "CARDSccUMFKoPRZxt5vt3ksUbxEFEcnZ3H2pd3dKxYjp", symbol: "CARDS", name: "Collector Crypt", group: "crypto", decimals: 6 },
  { mint: "APLPiTjBWzwfZ5U1TBeqLF9XJ7dV7XKGe7j4BZhkDray", symbol: "PEAK", name: "Peak", group: "crypto", decimals: 6 },
  { mint: "Bv1a7cEj5aRnJQhMw4kRQqAFesMSd5LwcDnUzq52BMmr", symbol: "FLOAT", name: "Float", group: "crypto", decimals: 6 },

  { mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", symbol: "SPYx", name: "S&P 500", group: "stocks", decimals: 8, token2022: true },
  { mint: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ", symbol: "QQQx", name: "Nasdaq 100", group: "stocks", decimals: 8, token2022: true },
  { mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", symbol: "NVDAx", name: "Nvidia", group: "stocks", decimals: 8, token2022: true },
  { mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", symbol: "TSLAx", name: "Tesla", group: "stocks", decimals: 8, token2022: true },
  { mint: "Xs3oZwbHvqis4NYcf4YKWmEia2eC84wSiVrcYcTqpH8", symbol: "SPCXx", name: "SpaceX", group: "stocks", decimals: 8, token2022: true },
  { mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", symbol: "AAPLx", name: "Apple", group: "stocks", decimals: 8, token2022: true },
  { mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN", symbol: "GOOGLx", name: "Google", group: "stocks", decimals: 8, token2022: true },
  { mint: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu", symbol: "METAx", name: "Meta", group: "stocks", decimals: 8, token2022: true },
  { mint: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg", symbol: "AMZNx", name: "Amazon", group: "stocks", decimals: 8, token2022: true },
  { mint: "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX", symbol: "MSFTx", name: "Microsoft", group: "stocks", decimals: 8, token2022: true },
  { mint: "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ", symbol: "MSTRx", name: "MicroStrategy", group: "stocks", decimals: 8, token2022: true },
  { mint: "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg", symbol: "HOODx", name: "Robinhood", group: "stocks", decimals: 8, token2022: true },
  { mint: "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu", symbol: "COINx", name: "Coinbase", group: "stocks", decimals: 8, token2022: true },
  { mint: "XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1", symbol: "CRCLx", name: "Circle", group: "stocks", decimals: 8, token2022: true },
  { mint: "XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2", symbol: "MCDx", name: "McDonald's", group: "stocks", decimals: 8, token2022: true },
  { mint: "Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc", symbol: "GMEx", name: "GameStop", group: "stocks", decimals: 8, token2022: true },
  { mint: "XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4", symbol: "PLTRx", name: "Palantir", group: "stocks", decimals: 8, token2022: true },
  { mint: "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re", symbol: "GLDx", name: "Gold", group: "stocks", decimals: 8, token2022: true },
  { mint: "XshPgPdXFRWB8tP1j82rebb2Q9rPgGX37RuqzohmArM", symbol: "INTCx", name: "Intel", group: "stocks", decimals: 8, token2022: true },

  { mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF", symbol: "OPENAI", name: "OpenAI", group: "preipo", decimals: 9, token2022: true },
  { mint: "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw", symbol: "ANTHROPIC", name: "Anthropic", group: "preipo", decimals: 9, token2022: true },
  { mint: "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua", symbol: "KALSHI", name: "Kalshi", group: "preipo", decimals: 9, token2022: true },
  { mint: "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP", symbol: "POLYMARKET", name: "Polymarket", group: "preipo", decimals: 9, token2022: true },
  { mint: "PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S", symbol: "NEURALINK", name: "Neuralink", group: "preipo", decimals: 9, token2022: true },
];

export const PAIR_BY_MINT: Record<string, Pair> = Object.fromEntries(PAIRS.map((p) => [p.mint, p]));
export const GROUP_LABEL = { crypto: "Crypto", stocks: "Stocks", preipo: "Pre-IPO" } as const;
export const pairSymbol = (mint: string, fallback = "?") => PAIR_BY_MINT[mint]?.symbol || fallback;
