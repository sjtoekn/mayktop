// A date (YYYY-MM-DD, UTC) `offsetDays` from now. Kept out of the page component because React's purity rule
// does not allow Date.now() while a component renders (same idea as daysLeft() in account.ts).
export function dayFromNow(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
