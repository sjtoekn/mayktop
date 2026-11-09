// Checks and prepares the video of a short (SHORTS_TODO 13-15). Server only.
// Pure Node + sharp: no database. The file names given to ffmpeg are random names we make ourselves; nothing a person
// typed is ever passed to ffmpeg.
//   sniffShortVideo()  the REAL type from the first bytes (the name / the browser's type are never trusted)
//   probeShort()       length and size of the picture (ffprobe)
//   makeShortFiles()   H.264 MP4 with sound, no metadata (no GPS / camera data), long side at most 1280 px, starts fast
//                      on the web, plus a WebP thumbnail
// ffmpeg and ffprobe must be installed (or named in FFMPEG_PATH / FFPROBE_PATH). Without them a short cannot be checked,
// so it is NOT accepted (result "ffmpeg-missing") - we never show a video whose length we could not verify.
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { SHORT_MAX_SECONDS, SHORT_MIN_SECONDS, SHORT_OUTPUT_MAX_SIDE, type ShortInputType } from "@/config/short-config";

export type ShortFailure = "media-type" | "too-short" | "too-long" | "ffmpeg-missing" | "processing-failed";

/** The real type of the bytes, or null when it is not an mp4 / mov / webm. */
export function sniffShortVideo(bytes: Uint8Array): ShortInputType | null {
  if (bytes.length < 16) return null;
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (ascii(4, 8) === "ftyp") return ascii(8, 12) === "qt  " ? "mov" : "mp4";
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm";
  return null;
}

type RunResult = { ok: true; stdout: string } | { ok: false; missing: boolean };

function run(binary: string, args: string[], timeoutMs: number): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(binary, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (!error) return resolve({ ok: true, stdout: String(stdout) });
      resolve({ ok: false, missing: (error as NodeJS.ErrnoException).code === "ENOENT" });
    });
  });
}

const ffmpegBinary = () => (process.env.FFMPEG_PATH?.trim() ? process.env.FFMPEG_PATH.trim() : "ffmpeg");
const ffprobeBinary = () => (process.env.FFPROBE_PATH?.trim() ? process.env.FFPROBE_PATH.trim() : "ffprobe");

export type ShortProbe = { durationMs: number; width: number; height: number };

/** Length and picture size of a video file, or a failure. */
export async function probeShort(file: string): Promise<{ ok: true; probe: ShortProbe } | { ok: false; error: ShortFailure }> {
  const result = await run(
    ffprobeBinary(),
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", file],
    30_000,
  );
  if (!result.ok) return { ok: false, error: result.missing ? "ffmpeg-missing" : "media-type" };
  try {
    const data = JSON.parse(result.stdout) as { streams?: { width?: number; height?: number }[]; format?: { duration?: string } };
    const stream = data.streams?.[0];
    const seconds = Number(data.format?.duration);
    if (!stream?.width || !stream?.height || !Number.isFinite(seconds) || seconds <= 0) return { ok: false, error: "media-type" };
    return { ok: true, probe: { durationMs: Math.round(seconds * 1000), width: stream.width, height: stream.height } };
  } catch {
    return { ok: false, error: "media-type" };
  }
}

export type MadeShort =
  | { ok: true; probe: ShortProbe }
  | { ok: false; error: ShortFailure };

/**
 * `input` = the raw upload, `outVideo` / `outThumb` = where to write the results (both in the same temp folder).
 * Checks the length first (the limits come from short-config.ts), then re-encodes.
 */
export async function makeShortFiles(input: string, outVideo: string, outThumb: string): Promise<MadeShort> {
  const probed = await probeShort(input);
  if (!probed.ok) return probed;
  const seconds = probed.probe.durationMs / 1000;
  // A second of slack, because container lengths are rounded differently by different programs.
  if (seconds < SHORT_MIN_SECONDS - 1) return { ok: false, error: "too-short" };
  if (seconds > SHORT_MAX_SECONDS + 1) return { ok: false, error: "too-long" };

  const side = SHORT_OUTPUT_MAX_SIDE;
  const result = await run(
    ffmpegBinary(),
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", input,
      "-t", String(SHORT_MAX_SECONDS), // never longer than the limit, whatever the file says
      "-sn", "-dn", "-map_metadata", "-1", // no subtitles, data tracks or metadata (GPS, camera)
      // The LONG side is at most `side` px, the other side keeps the proportions (even number).
      "-vf", `scale='if(gt(iw,ih),min(${side},iw),-2)':'if(gt(iw,ih),-2,min(${side},ih))'`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", // the sound is KEPT (a short without sound is not a short)
      "-movflags", "+faststart", // the video can start before it is fully downloaded
      outVideo,
    ],
    180_000,
  );
  if (!result.ok) return { ok: false, error: result.missing ? "ffmpeg-missing" : "processing-failed" };

  const finished = await probeShort(outVideo);
  if (!finished.ok) return { ok: false, error: "processing-failed" };

  // Thumbnail: one frame from the first seconds, rebuilt as a small WebP.
  const frame = path.join(path.dirname(outThumb), `frame-${randomBytes(6).toString("hex")}.png`);
  try {
    const at = Math.min(1, Math.max(0, finished.probe.durationMs / 1000 / 4));
    const shot = await run(
      ffmpegBinary(),
      ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(at), "-i", outVideo, "-frames:v", "1", frame],
      30_000,
    );
    if (!shot.ok) return { ok: false, error: shot.missing ? "ffmpeg-missing" : "processing-failed" };
    const webp = await sharp(await readFile(frame)).resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    await writeFile(outThumb, webp);
  } catch (error) {
    console.error("makeShortFiles thumbnail failed:", error);
    return { ok: false, error: "processing-failed" };
  } finally {
    await rm(frame, { force: true }).catch(() => {});
  }
  return { ok: true, probe: finished.probe };
}
