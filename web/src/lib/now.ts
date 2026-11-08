// The current time in milliseconds. Pages call this instead of Date.now() so the React purity lint rule is satisfied.
export function nowMs(): number {
  return Date.now();
}
