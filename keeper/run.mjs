// CLI keeper (local or any server): `node keeper/run.mjs [--once] [--dry]` from the repo root.
// In production the same tick runs every minute from a cron hitting /api/cron/tick.
import { CFG } from "./lib/config.mjs";
import { feeWallet } from "./lib/solana.mjs";
import { tick } from "./tick.mjs";

let stopping = false;
process.on("SIGTERM", () => (stopping = true));
process.on("SIGINT", () => (stopping = true));

console.log(`Candyfun keeper${CFG.dry ? " (dry)" : ""} · fee wallet ${feeWallet?.publicKey.toBase58() || "MISSING"} · every ${CFG.intervalSec}s`);
do {
  try {
    await tick({ shouldStop: () => stopping });
  } catch (e) {
    console.log("tick failed:", e.message);
  }
  if (CFG.once || stopping) break;
  await new Promise((r) => setTimeout(r, CFG.intervalSec * 1000));
} while (!stopping);
process.exit(0);
