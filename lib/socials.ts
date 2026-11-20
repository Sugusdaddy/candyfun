// Coin socials typed by the creator, normalised to clean https links (shared by the create form and
// the launch API, which re-validates). Empty input is fine: every field is optional.
export type Socials = { website?: string; twitter?: string; telegram?: string };
type Result = { value: string | null; error: string | null };

const ok = (value: string | null): Result => ({ value, error: null });
const bad = (error: string): Result => ({ value: null, error });

export function normWebsite(raw: string): Result {
  const s = raw.trim();
  if (!s) return ok(null);
  if (s.length > 200) return bad("Website is too long");
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return bad("Website must be a valid link");
    return ok(u.toString());
  } catch {
    return bad("Website must be a valid link");
  }
}

/** "@handle", "handle" or any x.com / twitter.com link (profile, community, post). */
export function normTwitter(raw: string): Result {
  const s = raw.trim();
  if (!s) return ok(null);
  const handle = s.replace(/^@/, "");
  if (/^[A-Za-z0-9_]{1,15}$/.test(handle)) return ok(`https://x.com/${handle}`);
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!/^(www\.|mobile\.)?(x|twitter)\.com$/i.test(u.hostname) || u.pathname.length < 2) return bad("X must be @handle or an x.com link");
    return ok(`https://x.com${u.pathname.replace(/\/$/, "")}`);
  } catch {
    return bad("X must be @handle or an x.com link");
  }
}

/** "@group", "group" or a t.me link. */
export function normTelegram(raw: string): Result {
  const s = raw.trim();
  if (!s) return ok(null);
  const plain = s.replace(/^@/, "");
  if (/^[A-Za-z0-9_]{3,64}$/.test(plain)) return ok(`https://t.me/${plain}`);
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!/^(www\.)?(t\.me|telegram\.me)$/i.test(u.hostname) || u.pathname.length < 2) return bad("Telegram must be @group or a t.me link");
    return ok(`https://t.me${u.pathname.replace(/\/$/, "")}`);
  } catch {
    return bad("Telegram must be @group or a t.me link");
  }
}

export function normSocials(input: { website?: string; twitter?: string; telegram?: string }): { socials: Socials; error: string | null } {
  const w = normWebsite(input.website || "");
  const x = normTwitter(input.twitter || "");
  const t = normTelegram(input.telegram || "");
  const error = w.error || x.error || t.error;
  const socials: Socials = {};
  if (w.value) socials.website = w.value;
  if (x.value) socials.twitter = x.value;
  if (t.value) socials.telegram = t.value;
  return { socials, error };
}

export const DESCRIPTION_MAX = 200;
