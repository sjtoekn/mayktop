// Checks the picture / video of an image or video ad (ADS_PLAN Session 3b, decision 10).
// Pure functions: no database, no disk, no React, so `npm run test:ad-media` can run them.
//
// What is checked:
//  - size: adsConfig.media.imageUploadMaxBytes (the picture is shrunk afterwards, ad-image.ts) / videoMaxBytes
//  - REAL content, not the name or the type the browser declared: the first bytes of the file must be a JPEG, PNG,
//    WebP (pictures) or MP4, WebM (videos). A file called "x.png" that is really something else is refused.
// The file name an advertiser typed is never used for anything: the stored name is random (ad-storage.ts).
import { adsConfig } from "../config/site";

export type MediaKind = "image" | "video";
export type MediaExt = "jpg" | "png" | "webp" | "mp4" | "webm";
export type MediaError = "media-missing" | "media-size" | "media-type";

export type CheckedMedia = { ok: true; ext: MediaExt; mime: string } | { ok: false; error: MediaError };

const MIME: Record<MediaExt, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};

/** The URL start of every stored ad file. imageUrl / videoUrl of an ad must start with this (never an outside address). */
export const MEDIA_URL_PREFIX = "/api/ad/media/";

/** A stored file name: 32 random hex characters + one allowed extension. Nothing else is ever served or deleted. */
export const MEDIA_FILE_RE = /^[a-f0-9]{32}\.(jpg|png|webp|mp4|webm)$/;

export function mimeOfExt(ext: string): string | null {
  return (MIME as Record<string, string>)[ext] ?? null;
}

export function mediaUrl(file: string): string {
  return `${MEDIA_URL_PREFIX}${file}`;
}

/** "/api/ad/media/<file>" -> "<file>", or null when it is not one of OUR media addresses. */
export function fileFromMediaUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url.startsWith(MEDIA_URL_PREFIX)) return null;
  const file = url.slice(MEDIA_URL_PREFIX.length);
  return MEDIA_FILE_RE.test(file) ? file : null;
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, i) => bytes[offset + i] === value);
}

function ascii(bytes: Uint8Array, from: number, to: number): string {
  let out = "";
  for (let i = from; i < Math.min(to, bytes.length); i++) out += String.fromCharCode(bytes[i]);
  return out;
}

/** The real type of a picture from its first bytes, or null. */
export function sniffImage(bytes: Uint8Array): MediaExt | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
  return null;
}

/** The real type of a video from its first bytes, or null. MP4: "ftyp" box at byte 4. WebM: EBML header with doctype "webm". */
export function sniffVideo(bytes: Uint8Array): MediaExt | null {
  if (ascii(bytes, 4, 8) === "ftyp") return "mp4";
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]) && ascii(bytes, 0, 64).includes("webm")) return "webm";
  return null;
}

/** Checks one file. `bytes` = the whole file. */
export function checkMedia(kind: MediaKind, bytes: Uint8Array | null | undefined): CheckedMedia {
  if (!bytes || bytes.length === 0) return { ok: false, error: "media-missing" };
  const max = kind === "image" ? adsConfig.media.imageUploadMaxBytes : adsConfig.media.videoMaxBytes; // pictures are made smaller later (ad-image.ts)
  if (bytes.length > max) return { ok: false, error: "media-size" };
  const ext = kind === "image" ? sniffImage(bytes) : sniffVideo(bytes);
  if (!ext) return { ok: false, error: "media-type" };
  return { ok: true, ext, mime: MIME[ext] };
}

/** Which files each format needs. TEXT: none. IMAGE: a picture. VIDEO: a video AND its poster picture. */
export function mediaNeeds(format: "TEXT" | "IMAGE" | "VIDEO"): { image: boolean; video: boolean } {
  return { image: format !== "TEXT", video: format === "VIDEO" };
}
