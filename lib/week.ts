// Airdrop weeks start Monday 00:00 UTC. Same rule as keeper/lib/indexer.mjs `weekKey`.
export function weekKey(t = Date.now()): string {
  const d = new Date(t);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** When the current week ends and its pot is paid. */
export function nextPayoutAt(t = Date.now()): number {
  return new Date(weekKey(t) + "T00:00:00Z").getTime() + 7 * 86400_000;
}
