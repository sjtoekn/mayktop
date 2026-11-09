"use server";

// Saves a new short (SHORTS_TODO 17-19). A login is needed to upload.
//  1. Title (required), description and privacy are checked and cleaned on the server (src/lib/short-input.ts).
//  2. Nobody logged in: refused with reason "login", before the video is even read.
//  3. Checking a video is work for the server, so it has its own limit (SHORT_CHECK_LIMIT), taken before the file is read.
//     The size and the REAL type (from the first bytes) are checked next.
//  4. Rate limit (SHORT_UPLOAD_LIMITS in src/config/short-config.ts): counted from the person's earlier shorts in the
//     database, in the same transaction that creates the new row (status PROCESSING). FAILED, hidden and deleted shorts
//     count too, so failing or deleting does not give a new turn. A new account gets the stricter limits (limitsFor).
//  5. The raw file waits in storage/shorts/tmp, is checked (length) and rebuilt by ffmpeg (src/lib/short-video.ts), and only
//     then the finished video + thumbnail are moved into place and the row becomes READY. If anything fails the row becomes
//     FAILED (with a short note for the owner) and every file is removed again: no file is left without a short.
import { rm, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import {
  SHORT_CHECK_LIMIT,
  SHORT_MAX_BYTES,
  SHORT_MAX_PARALLEL,
  SHORT_UPLOAD_LIMITS,
} from "@/config/short-config";
import { cleanShortDescription, cleanShortTitle, parseShortPrivacy } from "@/lib/short-input";
import { makeShortFiles, sniffShortVideo, type ShortFailure } from "@/lib/short-video";
import { deleteShortFiles, newShortName, publishShortFiles, saveShortUpload, shortTempDir } from "@/lib/short-storage";
import { takeActionDb } from "@/lib/rate-limit-db";
import { limitsFor } from "@/lib/account-limits";
import { checkRules, type RateRule } from "@/lib/social-limits";
import { ShortProcessing } from "../../../../../generated/prisma/enums";

const uploadRules: RateRule[] = SHORT_UPLOAD_LIMITS.map((rule) => ({ max: rule.max, windowMs: rule.windowMinutes * 60_000 }));
const LONGEST_WINDOW_MS = Math.max(...uploadRules.map((rule) => rule.windowMs));
const checkRulesForVideos: RateRule[] = [{ max: SHORT_CHECK_LIMIT.max, windowMs: SHORT_CHECK_LIMIT.windowMinutes * 60_000 }];

export type UploadShortResult =
  | { ok: true; id: number; file: string }
  | {
      ok: false;
      reason:
        | "error"
        | "login"
        | "title"
        | "invalid"
        | "privacy"
        | "noVideo"
        | "tooMany"
        | "busy"
        | "videoType"
        | "videoSize"
        | "tooShort"
        | "tooLong"
        | "noFfmpeg"
        | "processing";
      waitMinutes?: number; // with tooMany: about how long to wait
    };

const FAILURE_REASON: Record<ShortFailure, "videoType" | "tooShort" | "tooLong" | "noFfmpeg" | "processing"> = {
  "media-type": "videoType",
  "too-short": "tooShort",
  "too-long": "tooLong",
  "ffmpeg-missing": "noFfmpeg",
  "processing-failed": "processing",
};

// How many videos this server process is preparing right now (a plain counter; not exported: a "use server" file may only
// export async functions).
let running = 0;

export async function uploadShort(form: FormData): Promise<UploadShortResult> {
  if (!(form instanceof FormData)) return { ok: false, reason: "error" };

  const title = cleanShortTitle(form.get("title"));
  if (!title.ok) return { ok: false, reason: title.reason === "empty" ? "title" : "invalid" };
  const description = cleanShortDescription(form.get("description"));
  if (!description.ok) return { ok: false, reason: "invalid" };
  const privacy = parseShortPrivacy(form.get("privacy"));
  if (!privacy.ok) return { ok: false, reason: "privacy" };

  const file = form.get("video");
  if (!(file instanceof File) || file.size === 0) return { ok: false, reason: "noVideo" };

  const owner = await getSessionUser();
  if (!owner) return { ok: false, reason: "login" };

  const turn = await takeActionDb(`short-video:${owner.id}`, checkRulesForVideos);
  if (!turn.ok) return { ok: false, reason: "tooMany", waitMinutes: Math.max(1, Math.ceil(turn.retryAfterMs / 60_000)) };
  if (file.size > SHORT_MAX_BYTES) return { ok: false, reason: "videoSize" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!sniffShortVideo(bytes)) return { ok: false, reason: "videoType" };

  if (running >= SHORT_MAX_PARALLEL) return { ok: false, reason: "busy" };
  running += 1;

  const tmpFiles: string[] = [];
  const stored: { name: string | null } = { name: null };
  let shortId: number | null = null;
  try {
    const input = await saveShortUpload(bytes);
    tmpFiles.push(input);

    // 1) The row (PROCESSING), after the rate limit said yes, in one transaction.
    const name = newShortName();
    const outcome = await prisma.$transaction(async (tx) => {
      const now = Date.now();
      const earlier = await tx.short.findMany({
        where: { ownerId: owner.id, createdAt: { gte: new Date(now - LONGEST_WINDOW_MS) } },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const rate = checkRules(earlier.map((row) => row.createdAt.getTime()), limitsFor(uploadRules, owner), now);
      if (!rate.ok) return rate;
      const created = await tx.short.create({
        data: {
          ownerId: owner.id,
          file: name,
          title: title.title,
          description: description.description,
          privacy: privacy.privacy,
          processing: ShortProcessing.PROCESSING,
          sizeBytes: file.size,
        },
        select: { id: true },
      });
      return { ok: true as const, id: created.id };
    });
    if (!outcome.ok) {
      return { ok: false, reason: "tooMany", waitMinutes: Math.max(1, Math.ceil(outcome.retryAfterMs / 60_000)) };
    }
    shortId = outcome.id;

    // 2) Check the length and rebuild the video + thumbnail.
    const stem = randomBytes(12).toString("hex");
    const outVideo = path.join(shortTempDir(), `${stem}-out.mp4`);
    const outThumb = path.join(shortTempDir(), `${stem}-out.webp`);
    tmpFiles.push(outVideo, outThumb);
    const made = await makeShortFiles(input, outVideo, outThumb);
    if (!made.ok) {
      await prisma.short.update({ where: { id: shortId }, data: { processing: ShortProcessing.FAILED, processingNote: made.error } });
      return { ok: false, reason: FAILURE_REASON[made.error] };
    }

    // 3) Move the finished pair into place and mark the short READY.
    const finalSize = (await stat(outVideo)).size;
    await publishShortFiles(name, outVideo, outThumb);
    stored.name = name;
    await prisma.short.update({
      where: { id: shortId },
      data: {
        processing: ShortProcessing.READY,
        processingNote: null,
        durationMs: made.probe.durationMs,
        width: made.probe.width,
        height: made.probe.height,
        sizeBytes: finalSize,
        readyAt: new Date(),
      },
    });
    return { ok: true, id: shortId, file: name };
  } catch (error) {
    console.error("uploadShort failed:", error);
    await deleteShortFiles([stored.name]); // no file is left behind without a short
    if (shortId !== null) {
      await prisma.short
        .update({ where: { id: shortId }, data: { processing: ShortProcessing.FAILED, processingNote: "processing-failed" } })
        .catch(() => {});
    }
    return { ok: false, reason: "error" };
  } finally {
    running -= 1;
    for (const tmp of tmpFiles) await rm(tmp, { force: true }).catch(() => {});
  }
}
