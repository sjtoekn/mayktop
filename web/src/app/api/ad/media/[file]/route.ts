// GET /api/ad/media/<file>: serves the picture / video of an ad from OUR storage folder (ADS_PLAN Session 3b).
//  - Only a file that belongs to an ad is served (found by its address in the database); anything else is 404.
//  - ACTIVE ads: public, long cache. Any other status (a reviewer, or the advertiser looking at their own ad):
//    only for the advertiser or an admin, never cached by shared caches.
//  - Range requests are supported, so a video can start and be skipped through (Safari needs this).
// No visitor data is read or kept here: no cookie is needed for a public ad, nothing is logged per visitor.
import fs from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { adMediaPath } from "@/lib/ad-storage";
import { mediaUrl, mimeOfExt, MEDIA_FILE_RE } from "@/lib/ad-media";
import { AdStatus, Role } from "../../../../../../generated/prisma/client";

const NOT_FOUND = () => new NextResponse("Not found", { status: 404 });

export async function GET(request: NextRequest, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  if (!MEDIA_FILE_RE.test(file)) return NOT_FOUND();
  const full = adMediaPath(file);
  if (!full) return NOT_FOUND();

  const address = mediaUrl(file);
  const ad = await prisma.adCampaign.findFirst({
    where: { OR: [{ imageUrl: address }, { videoUrl: address }] },
    select: { status: true, advertiserId: true },
  });
  if (!ad) return NOT_FOUND();

  const isPublic = ad.status === AdStatus.ACTIVE;
  if (!isPublic) {
    const user = await getSessionUser();
    if (!user) return NOT_FOUND();
    if (user.id !== ad.advertiserId) {
      // Reviewers are admins (the same rule as /admin/ads). The role is read from the database, never from the cookie.
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
  const mime = mimeOfExt(file.slice(file.lastIndexOf(".") + 1)) ?? "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": isPublic ? "public, max-age=86400" : "private, no-store",
  };

  let start = 0;
  let end = size - 1;
  let status = 200;
  const range = request.headers.get("range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (m[1] === "" && m[2] === "")) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    if (m[1] === "") {
      start = Math.max(0, size - Number(m[2])); // "last N bytes"
    } else {
      start = Number(m[1]);
      if (m[2] !== "") end = Math.min(end, Number(m[2]));
    }
    if (start > end || start >= size) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  headers["Content-Length"] = String(end - start + 1);

  const stream = Readable.toWeb(fs.createReadStream(full, { start, end })) as ReadableStream;
  return new NextResponse(stream, { status, headers });
}
