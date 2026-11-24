// Numbers for the "Best of the community" box in the right column (replaces the fake "Trending Now").
// The rules are in src/lib/best-of-rules.ts, the database reads in src/lib/best-of.ts. PROVISIONAL: tune after real use.
export const bestOfConfig = {
  size: 4, // places on one slide
  risingEvery: 4, // every 4th place of a slide is reserved for a new voice (same idea as the Popular page)
  risingLuck: 2, // weight of the fair draw next to the score in the reserved places
  seedHours: 6, // the fair draw is the same inside one window of this many hours, then changes
  newAccountDays: 30, // an account younger than this is a "new voice" ...
  newVoiceMaxItems: 3, // ... and so is an account with this many items (comments / posts / photos / shorts) or fewer
  helpersWindowDays: 30, // helpful answers are counted over this many days
  topicsWindowDays: 14, // "busy topics" are counted over this many days
  socialWindowDays: 14,
  mediaWindowDays: 30, // photos and shorts
  scanLimit: 2000, // at most this many rows are read per section
  rotateSeconds: 7, // the box shows the next slide after this many seconds
};
