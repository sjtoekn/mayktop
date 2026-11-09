// Reads for the Shorts feed and the page of one short (SHORTS_TODO 21, 27). Server only.
// A short is in the PUBLIC feed only when: processing READY, status VISIBLE, privacy PUBLIC, not deleted, owner shown
// (same account rule as Social and the media route). Newest first (see short-feed-rules.ts). Block / Mute come with step 7 (item 40).
import { prisma } from "@/lib/prisma";
import { SHORT_FEED_MAX_PAGE_SIZE, SHORT_FEED_PAGE_SIZE } from "@/config/short-feed-config";
import { shortThumbUrl, shortVideoUrl } from "@/lib/short-file";
import { encodeShortCursor, parseShortCursor, spreadCreators } from "@/lib/short-feed-rules";
import type { ShortCardData } from "@/lib/short-card";
import { isSocialAuthorShown } from "@/lib/social-visibility";
import { ContentStatus, Role, ShortPrivacy, ShortProcessing, UserStatus } from "../../generated/prisma/client";

const cardSelect = {
  id: true,
  file: true,
  title: true,
  description: true,
  ownerId: true,
  durationMs: true,
  width: true,
  height: true,
  createdAt: true,
  owner: { select: { username: true, displayName: true, status: true, deletedAt: true } },
} as const;

type Row = {
  id: number;
  file: string;
  title: string | null;
  description: string | null;
  ownerId: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  createdAt: Date;
  owner: { username: string; displayName: string | null; status: UserStatus; deletedAt: Date | null };
};

function toCard(row: Row): ShortCardData {
  return {
    id: row.id,
    videoUrl: shortVideoUrl(row.file),
    thumbUrl: shortThumbUrl(row.file),
    title: row.title ?? "",
    description: row.description ?? "",
    ownerId: row.ownerId,
    username: row.owner.username,
    displayName: row.owner.displayName,
    durationMs: row.durationMs,
    width: row.width,
    height: row.height,
    createdAtMs: row.createdAt.getTime(),
  };
}

export type ShortsPage = { items: ShortCardData[]; next: string | null };

/** One page of the public feed. `cursorRaw` is the `next` of the previous page (anything unreadable = first page). */
export async function getShortsFeed(cursorRaw: unknown, size: number = SHORT_FEED_PAGE_SIZE, excludeId?: number): Promise<ShortsPage> {
  const take = Math.min(Math.max(1, Math.floor(size) || SHORT_FEED_PAGE_SIZE), SHORT_FEED_MAX_PAGE_SIZE);
  const cursor = parseShortCursor(cursorRaw);
  const rows = (await prisma.short.findMany({
    where: {
      processing: ShortProcessing.READY,
      status: ContentStatus.VISIBLE,
      privacy: ShortPrivacy.PUBLIC,
      deletedAt: null,
      owner: { status: UserStatus.ACTIVE, deletedAt: null },
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAtMs) } },
              { createdAt: new Date(cursor.createdAtMs), id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    select: cardSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
  })) as Row[];

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const last = page[page.length - 1];
  const next = hasMore && last ? encodeShortCursor({ createdAtMs: last.createdAt.getTime(), id: last.id }) : null;
  const shown = page.filter((row) => isSocialAuthorShown(row.owner) && row.id !== excludeId).map(toCard);
  return { items: spreadCreators(shown), next };
}

/** One short for its own page /shorts/<id>. PUBLIC and UNLISTED: anyone with the link. Anything else: only its owner and admins
 *  (same rule as the media route, so the page and the file never disagree). null = "not found". */
export async function getShortForViewer(id: number, viewer: { id: string } | null): Promise<ShortCardData | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const row = (await prisma.short.findUnique({
    where: { id },
    select: { ...cardSelect, status: true, processing: true, privacy: true, deletedAt: true },
  })) as (Row & { status: ContentStatus; processing: ShortProcessing; privacy: ShortPrivacy; deletedAt: Date | null }) | null;
  if (!row || row.deletedAt) return null;

  const shown =
    row.status === ContentStatus.VISIBLE &&
    row.processing === ShortProcessing.READY &&
    row.privacy !== ShortPrivacy.PRIVATE &&
    isSocialAuthorShown(row.owner);
  if (!shown) {
    if (!viewer) return null;
    if (viewer.id !== row.ownerId) {
      const who = await prisma.user.findUnique({ where: { id: viewer.id }, select: { role: true } });
      if (who?.role !== Role.ADMIN) return null;
    }
    if (row.processing !== ShortProcessing.READY) return null; // nothing to play yet
  }
  return toCard(row);
}
