// Prepares the video of a video ad (changed 2026-11-08, ADS_PLAN decision 10b). Server only.
// A video ad plays by itself, silent, for at most `seconds` seconds (10), and the whole ad is the link. The advertiser may send a
// longer video (30 or 40 seconds): we only ever show the first 10. With ffmpeg installed, the saved file is REALLY cut:
//   first `seconds` seconds only, no sound, no metadata (no location / camera data), H.264 MP4 that starts fast on the web,
//   at most 1280 pixels wide. Without ffmpeg the file is saved as it is, and the player still stops at the 10th second
//   (components/AdVideo.tsx), so nothing longer is ever shown either way.
// This file has no imports from the project (only Node), so it can be tested alone. The file names given to ffmpeg are random
// names we make ourselves; nothing the advertiser typed is ever passed to ffmpeg.
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export type PreparedVideo =
  | { ok: true; bytes: Uint8Array; ext: "mp4" | "webm"; cut: boolean }
  | { ok: false; error: "media-type" };

type RunResult = { ok: true } | { ok: false; missing: boolean };

function run(binary: string, args: string[], timeoutMs: number): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(binary, args, { timeout: timeoutMs, windowsHide: true }, (error) => {
      if (!error) return resolve({ ok: true });
      resolve({ ok: false, missing: (error as NodeJS.ErrnoException).code === "ENOENT" });
    });
  });
}

/** `ffmpeg` from the PATH, or the file named in the FFMPEG_PATH setting. */
function ffmpegBinary(): string {
  const custom = process.env.FFMPEG_PATH;
  return custom && custom.trim() !== "" ? custom.trim() : "ffmpeg";
}

/**
 * Cuts the video to `seconds` seconds and removes the sound. `ext` = the real type found by sniffVideo().
 * - ffmpeg not installed: the original bytes come back unchanged (`cut: false`).
 * - ffmpeg installed but cannot read the file (a broken or fake video): { ok: false, error: "media-type" }.
 */
export async function prepareAdVideo(bytes: Uint8Array, ext: "mp4" | "webm", seconds: number): Promise<PreparedVideo> {
  const binary = ffmpegBinary();
  const dir = await mkdtemp(path.join(tmpdir(), "ad-video-"));
  const input = path.join(dir, `in-${randomBytes(8).toString("hex")}.${ext}`);
  const output = path.join(dir, `out-${randomBytes(8).toString("hex")}.mp4`);
  try {
    await writeFile(input, bytes);
    const result = await run(
      binary,
      [
        "-hide_banner", "-loglevel", "error", "-y",
        "-i", input,
        "-t", String(seconds), // the first N seconds only
        "-an", // no sound
        "-sn", "-dn", "-map_metadata", "-1", // no subtitles, data tracks or metadata (GPS, camera)
        "-vf", "scale='min(1280,iw)':-2", // never wider than 1280 px, even height
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", // the video can start before it is fully downloaded
        output,
      ],
      90_000,
    );
    if (!result.ok) {
      if (result.missing) return { ok: true, bytes, ext, cut: false };
      return { ok: false, error: "media-type" };
    }
    const cut = await readFile(output);
    if (cut.length === 0) return { ok: false, error: "media-type" };
    return { ok: true, bytes: new Uint8Array(cut), ext: "mp4", cut: true };
  } catch (error) {
    console.error("prepareAdVideo failed:", error);
    return { ok: false, error: "media-type" };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
