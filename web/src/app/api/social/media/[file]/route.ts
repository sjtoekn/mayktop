// GET /api/social/media/<file>: serves the picture of a Social post from OUR storage folder (patch-social-images).
//  - Visitors (not logged in) may see the picture of a post that may be shown (changed 2026-11-08, Social is readable
//    without a login). A hidden / removed post's picture is never given to a visitor: 404.
//  - Only a file that belongs to a post is served (found by its address in the database); anything else is 404.
//  - A post that may be shown (visible, not deleted, author shown: src/lib/social-visibility.ts): anybody, logged in or not.
//    A hidden / removed post, or one whose author is not shown: only its author and admins (moderators must be able to
//    judge a report). A deleted post has no picture any more.
//  - The role is read from the database, never from the cookie.
// The file is a rebuilt copy without Exif / location data (src/lib/social-image.ts). Extra headers: no sniffing, and a
// sandbox policy, so even a wrong file could never run as a page.
import fs from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { socialMediaPath } from "@/lib/social-image-storage";
import { mimeOfSocialImage, SOCIAL_IMAGE_FILE_RE, socialImageUrl } from "@/lib/social-image";
import { isSocialAuthorShown } from "@/lib/social-visibility";
import { ContentStatus, Role } from "../../../../../../generated/prisma/client";

const NOT_FOUND = () => new NextResponse("Not found", { status: 404 });

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  if (!SOCIAL_IMAGE_FILE_RE.test(file)) return NOT_FOUND();
  const full = socialMediaPath(file);
  if (!full) return NOT_FOUND();

  const user = await getSessionUser(); // null = a visitor

  const post = await prisma.socialPost.findFirst({
    where: { mediaUrl: socialImageUrl(file) },
    select: { status: true, deletedAt: true, authorId: true, author: { select: { status: true, deletedAt: true } } },
  });
  if (!post || post.deletedAt) return NOT_FOUND();

  const shown = post.status === ContentStatus.VISIBLE && isSocialAuthorShown(post.author);
  if (!shown) {
    if (!user) return NOT_FOUND();
    if (user.id !== post.authorId) {
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
      "Content-Type": mimeOfSocialImage(file) ?? "application/octet-stream",
      "Content-Length": String(size),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
      // A picture that may be shown is public now (a visitor may see it), so a shared cache may keep it. The name never
      // changes for the same bytes, so one hour is safe. A hidden picture (only its author / admins) is never cached.
      "Cache-Control": shown ? "public, max-age=3600" : "private, no-store",
    },
  });
}
