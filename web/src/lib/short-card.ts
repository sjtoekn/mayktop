// The data one short card in the feed needs. A plain object (no dates, no database types) so it can travel to the browser.
export type ShortCardData = {
  id: number;
  videoUrl: string;
  thumbUrl: string;
  title: string;
  description: string;
  ownerId: string;
  username: string;
  displayName: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  createdAtMs: number;
};
