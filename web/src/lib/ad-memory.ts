// Browser-side memory of which ads THIS browser has shown lately, so it does not show the same ad
// again within `rotation.noRepeatMinutes`. It never leaves the visitor's device:
//   - Always: a small in-page memory (a JavaScript variable). It disappears when the page is reloaded
//     or closed, so it stores nothing on the device.
//   - Only if the visitor switches it on (in "Why this ad?") AND the browser does not send Global
//     Privacy Control: the same list is also kept in localStorage, so it survives a reload for the hour.
// The server never receives this list. Client code only (imports nothing from the server).

const SEEN_KEY = "mt_ad_seen"; // { "<adId>": <time shown, ms> }
const REMEMBER_KEY = "mt_ad_remember"; // "yes" when the visitor switched the one-hour memory on
const MAX_ENTRIES = 300;

const inPage = new Map<number, number>();
const listeners = new Set<() => void>();

export type RememberState = "on" | "off" | "blocked";

/** True when the browser sends the Global Privacy Control signal. Then nothing is ever stored. */
export function privacySignalOn(): boolean {
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

function storedChoice(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) === "yes";
  } catch {
    return false;
  }
}

/** For the switch in "Why this ad?". "blocked" = the browser's privacy signal is on. */
export function getRememberState(): RememberState {
  if (privacySignalOn()) return "blocked";
  return storedChoice() ? "on" : "off";
}

export function subscribeRemember(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Switch the one-hour memory on or off. Switching off also erases what was stored. */
export function setRemember(on: boolean): void {
  try {
    if (on && !privacySignalOn()) {
      localStorage.setItem(REMEMBER_KEY, "yes");
    } else {
      localStorage.removeItem(REMEMBER_KEY);
      localStorage.removeItem(SEEN_KEY);
    }
  } catch {
    /* private mode: only the in-page memory is used */
  }
  listeners.forEach((notify) => notify());
}

function readStored(): Record<string, number> {
  if (getRememberState() !== "on") return {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** Ad id -> time it was shown, only entries newer than the window. */
function readSeen(now: number, windowMs: number): Map<number, number> {
  const seen = new Map<number, number>();
  const add = (id: number, at: number) => {
    if (Number.isFinite(id) && typeof at === "number" && now - at < windowMs) {
      seen.set(id, Math.max(at, seen.get(id) ?? 0));
    }
  };
  inPage.forEach((at, id) => add(id, at));
  for (const [key, at] of Object.entries(readStored())) add(Number(key), at);
  return seen;
}

function markSeen(id: number, now: number, windowMs: number): void {
  inPage.set(id, now);
  if (getRememberState() !== "on") return;
  const seen = readSeen(now, windowMs);
  seen.set(id, now);
  const newest = [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Object.fromEntries(newest)));
  } catch {
    /* storage full or blocked: the in-page memory still works */
  }
}

/**
 * Picks one ad from the pool: at random among those NOT shown in the last `windowMs`. If every ad in the
 * pool was shown lately, the one shown LONGEST ago is used, so a slot is never empty. Remembers the choice.
 */
export function pickAd<T extends { id: number }>(
  pool: T[],
  now: number,
  windowMs: number,
  random: () => number = Math.random,
): T | null {
  if (pool.length === 0) return null;
  const seen = readSeen(now, windowMs);
  const fresh = pool.filter((ad) => !seen.has(ad.id));
  const chosen =
    fresh.length > 0
      ? fresh[Math.floor(random() * fresh.length)]
      : pool.reduce((best, ad) => ((seen.get(ad.id) ?? 0) < (seen.get(best.id) ?? 0) ? ad : best), pool[0]);
  markSeen(chosen.id, now, windowMs);
  return chosen;
}
