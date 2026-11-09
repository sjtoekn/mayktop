// GET /api/shorts/media/<file>: serves a short (the video, or its thumbnail) from OUR storage folder (SHORTS_TODO 12).
//  - The video supports "Range" requests (206 Partial Content), so playing starts at once and the person can jump to any second.
//  - A short that may be shown: status VISIBLE, processing READY, not deleted, owner shown (the same account rule as Social)
//    and privacy PUBLIC or UNLISTED (UNLISTED = anyone who has the link; it is only kept out of lists).
//  - Everything else (PRIVATE, hidden / removed, still processing, failed, owner not shown): only its owner and admins
//    (a moderator or admin must be able to judge a report). A deleted short has no file any more: 404.
//  - Only a file that belongs to a short is served (found by its name in the database); anything else is 404.
//  - The role is read from the database, never from the cookie.
// Extra headers: no sniffing and a sandbox policy, so even a wrong file could never run as a page.
import fs from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { shortFullNameOf } from "@/lib/short-file";
import { parseRange } from "@/lib/short-range";
import { shortMediaPath } from "@/lib/short-storage";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isSocialAuthorShown } from "@/lib/social-visibility";
import { ContentStatus, Role, ShortPrivacy, ShortProcessing } from "../../../../../../generated/prisma/client";

const NOT_FOUND = () => new NextResponse("Not found", { status: 404 });

export async function GET(request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const fullName = shortFullNameOf(file);
  if (!fullName) return NOT_FOUND();
  const full = shortMediaPath(file);
  if (!full) return NOT_FOUND();

  const short = await prisma.short.findUnique({
    where: { file: fullName },
    select: {
      status: true,
      processing: true,
      privacy: true,
      deletedAt: true,
      ownerId: true,
      owner: { select: { status: true, deletedAt: true } },
    },
  });
  if (!short || short.deletedAt) return NOT_FOUND();

  const shown =
    short.status === ContentStatus.VISIBLE &&
    short.processing === ShortProcessing.READY &&
    short.privacy !== ShortPrivacy.PRIVATE &&
    isSocialAuthorShown(short.owner);
  if (!shown) {
    const user = await getSessionUser(); // null = a visitor
    if (!user) return NOT_FOUND();
    if (user.id !== short.ownerId) {
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

  const isVideo = file.endsWith(".mp4");
  const headers: Record<string, string> = {
    "Content-Type": isVideo ? "video/mp4" : "image/webp",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": "inline",
    // PUBLIC and shown: a shared cache may keep it (the name never changes for the same bytes). UNLISTED: only the
    // browser. Anything not shown (private, hidden, processing): never cached.
    "Cache-Control": shown ? (short.privacy === ShortPrivacy.PUBLIC ? "public, max-age=3600" : "private, max-age=3600") : "private, no-store",
  };

  const range = parseRange(request.headers.get("range"), size);
  if (range.kind === "unsatisfiable") {
    return new NextResponse(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  }
  if (range.kind === "ok") {
    const { start, end } = range.range;
    const stream = Readable.toWeb(fs.createReadStream(full, { start, end })) as ReadableStream;
    return new NextResponse(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(fs.createReadStream(full)) as ReadableStream;
  return new NextResponse(stream, { status: 200, headers: { ...headers, "Content-Length": String(size) } });
}
