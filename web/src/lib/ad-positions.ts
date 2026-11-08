// Where ads go inside a list of posts (PROJECT.md section 5: fixed, limited places). Pure numbers, no React, so it is easy to test.
// An ad goes AFTER the post at these 0-based indexes: never first, at least 3 posts apart, at most 2 per page.
// Change the numbers here only.
export const FEED_AD_AFTER = [1, 5] as const; // community, Home and Popular feeds
export const SOCIAL_AD_AFTER = [2, 7] as const; // the Social feed (ADS_PLAN decision 11, Session S)

export function isFeedAdPosition(index: number): boolean {
  return (FEED_AD_AFTER as readonly number[]).includes(index);
}

export function isSocialAdPosition(index: number): boolean {
  return (SOCIAL_AD_AFTER as readonly number[]).includes(index);
}

/** The rule above, as a check: ascending, at most 2, never index 0, at least 3 apart. */
export function positionsAreValid(list: readonly number[]): boolean {
  if (list.length > 2) return false;
  return list.every((n, i) => Number.isInteger(n) && n >= 1 && (i === 0 || n - list[i - 1] >= 3));
}
