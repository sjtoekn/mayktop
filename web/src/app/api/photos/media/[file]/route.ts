// GET /api/photos/media/<file>: serves a photo (full copy or thumbnail) from OUR storage folder (PHOTO_TODO 3).
//  - ANYBODY, logged in or not, may see a photo that may be shown (decided 2026-11-08, PHOTO_TODO 1a): status VISIBLE,
//    not deleted, owner shown (src/lib/social-visibility.ts, the same account rule as Social).
//  - A hidden / removed photo, or one whose owner is not shown: only its owner and admins (a moderator or admin must be
//    able to judge a report). A deleted photo has no file any more: 404.
//  - Only a file that belongs to a photo is served (found by its name in the database); anything else is 404.
//  - The role is read from the database, never from the cookie.
// The file is a rebuilt WebP without Exif / location data (src/lib/photo-image.ts). Extra headers: no sniffing and a
// sandbox policy, so even a wrong file could never run as a page.
import fs from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { photoFullNameOf } from "@/lib/photo-file";
import { photoMediaPath } from "@/lib/photo-storage";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isSocialAuthorShown } from "@/lib/social-visibility";
import { ContentStatus, Role } from "../../../../../../generated/prisma/client";

const NOT_FOUND = () => new NextResponse("Not found", { status: 404 });

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const fullName = photoFullNameOf(file);
  if (!fullName) return NOT_FOUND();
  const full = photoMediaPath(file);
  if (!full) return NOT_FOUND();

  const photo = await prisma.photo.findUnique({
    where: { file: fullName },
    select: { status: true, deletedAt: true, ownerId: true, owner: { select: { status: true, deletedAt: true } } },
  });
  if (!photo || photo.deletedAt) return NOT_FOUND();

  const shown = photo.status === ContentStatus.VISIBLE && isSocialAuthorShown(photo.owner);
  if (!shown) {
    const user = await getSessionUser(); // null = a visitor
    if (!user) return NOT_FOUND();
    if (user.id !== photo.ownerId) {
      const row = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
      if (row?.role !== Role.ADMIN) return NOT_FOUND();
    }
  }

  let size: number;
  try {
    size = (await stat(full)).size;
  } catch {
    return NOT_FOUND();
  }
  const stream = Readable.toWeb(fs.createReadStream(full)) as ReadableStream;
  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(size),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
      // A photo that may be shown is public (a visitor may see it), so a shared cache may keep it. The name never changes
      // for the same bytes, so one hour is safe. A hidden photo (only its owner / admins) is never cached.
      "Cache-Control": shown ? "public, max-age=3600" : "private, no-store",
    },
  });
}
