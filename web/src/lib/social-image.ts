// Checks and CLEANS the picture of a Social post (patch-social-images, PROJECT.md 8j.5).
// Pure functions: no database, no disk, no React, so `npm run test:social-image` can run them.
//
// What is checked (the browser is never trusted; this runs on the server every time):
//  - size: socialMedia.imageMaxBytes
//  - REAL content, not the file name or the type the browser declared: the first bytes must be a JPEG, PNG or WebP
//    (the same check as the ad pictures, `sniffImage`). SVG is not accepted (it can carry script).
//  - the file is read to the end and structurally checked; a broken or truncated file is refused ("type").
//  - number of pixels: socialMedia.maxPixels and maxSide (a small file can still be a huge picture that uses
//    gigabytes of memory in other people's browsers).
// What is CLEANED (privacy): the picture that is saved is a rebuilt copy, not the uploaded bytes.
//  - JPEG: only picture data, JFIF header, colour profile and Adobe marker are kept. Exif (GPS location, camera,
//    date), XMP, IPTC, comments, thumbnails and everything after the end of the picture are removed. The ORIENTATION is
//    kept (a tiny new Exif with that one number), otherwise phone photos would turn sideways.
//  - PNG: text, Exif and time chunks are removed. WebP: Exif and XMP are removed. Anything after the end is removed.
// If a file cannot be understood completely it is refused: nothing is ever saved "as it came".
import { socialMedia } from "../config/site";
import { sniffImage } from "./ad-media";

export type SocialImageExt = "jpg" | "png" | "webp";
export type SocialImageError = "size" | "type" | "pixels";

export type CheckedSocialImage =
  | { ok: true; ext: SocialImageExt; mime: string; bytes: Uint8Array; width: number; height: number }
  | { ok: false; error: SocialImageError };

const MIME: Record<SocialImageExt, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** The address start of every stored Social picture. */
export const SOCIAL_IMAGE_URL_PREFIX = "/api/social/media/";

/** A stored file name: 32 random hex characters + one allowed extension. Nothing else is ever served or deleted. */
export const SOCIAL_IMAGE_FILE_RE = /^[a-f0-9]{32}\.(jpg|png|webp)$/;

export function socialImageUrl(file: string): string {
  return `${SOCIAL_IMAGE_URL_PREFIX}${file}`;
}

/** "/api/social/media/<file>" -> "<file>", or null when it is not one of OUR Social picture addresses. */
export function fileFromSocialImageUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url.startsWith(SOCIAL_IMAGE_URL_PREFIX)) return null;
  const file = url.slice(SOCIAL_IMAGE_URL_PREFIX.length);
  return SOCIAL_IMAGE_FILE_RE.test(file) ? file : null;
}

export function mimeOfSocialImage(file: string): string | null {
  const ext = file.slice(file.lastIndexOf(".") + 1);
  return (MIME as Record<string, string>)[ext] ?? null;
}

// ---------------------------------------------------------------- small helpers

type Cleaned = { bytes: Uint8Array; width: number; height: number };

const ascii = (b: Uint8Array, from: number, to: number): string => {
  let out = "";
  for (let i = from; i < Math.min(to, b.length); i++) out += String.fromCharCode(b[i]);
  return out;
};
const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32be = (b: Uint8Array, o: number) => b[o] * 2 ** 24 + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]);
const u32le = (b: Uint8Array, o: number) => b[o] + (b[o + 1] << 8) + (b[o + 2] << 16) + b[o + 3] * 2 ** 24;

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

// ---------------------------------------------------------------- JPEG

/** The Exif orientation (1-8) from the data of an Exif APP1 segment (starting at "Exif\0\0"), or 1. */
function exifOrientation(data: Uint8Array): number {
  const t = data.subarray(6);
  if (t.length < 8) return 1;
  const le = t[0] === 0x49 && t[1] === 0x49;
  const be = t[0] === 0x4d && t[1] === 0x4d;
  if (!le && !be) return 1;
  const r16 = (o: number) => (o + 2 <= t.length ? (le ? u16le(t, o) : u16be(t, o)) : -1);
  const r32 = (o: number) => (o + 4 <= t.length ? (le ? u32le(t, o) : u32be(t, o)) : -1);
  if (r16(2) !== 42) return 1;
  const ifd = r32(4);
  if (ifd < 8 || ifd + 2 > t.length) return 1;
  const count = r16(ifd);
  for (let i = 0; i < count && i < 64; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > t.length) break;
    if (r16(entry) === 0x0112 && r16(entry + 2) === 3 && r32(entry + 4) === 1) {
      const value = r16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

/** A new Exif segment that holds ONLY the orientation (34 bytes). */
function orientationSegment(value: number): Uint8Array {
  return Uint8Array.from([
    0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // APP1, length 34, "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // TIFF header (big endian), first IFD at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, value, 0x00, 0x00, // Orientation = value
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ]);
}

function cleanJpeg(b: Uint8Array): Cleaned | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const kept: Uint8Array[] = [];
  let orientation = 1;
  let width = 0;
  let height = 0;
  let sawScan = false;
  let ended = false;
  let pos = 2;

  while (pos < b.length) {
    if (b[pos] !== 0xff) return null;
    while (pos < b.length && b[pos] === 0xff) pos++; // fill bytes
    if (pos >= b.length) return null;
    const marker = b[pos];
    pos++;

    if (marker === 0xd9) { // end of the picture: anything after it is dropped
      ended = true;
      break;
    }
    if (marker === 0x00 || marker === 0xd8) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue; // markers without a length

    if (pos + 2 > b.length) return null;
    const length = u16be(b, pos);
    if (length < 2 || pos + length > b.length) return null;
    const segStart = pos - 2; // includes the 0xFF of the marker
    const segEnd = pos + length;
    const data = b.subarray(pos + 2, segEnd);
    const whole = b.subarray(segStart, segEnd);

    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) { // SOF: size
      if (data.length < 6) return null;
      height = u16be(data, 1);
      width = u16be(data, 3);
      kept.push(whole);
    } else if (marker === 0xda) { // SOS: the header, then the packed picture data up to the next real marker
      kept.push(whole);
      pos = segEnd;
      const scanStart = pos;
      while (pos < b.length) {
        if (b[pos] === 0xff) {
          const next = b[pos + 1];
          if (next === undefined) return null;
          if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) { pos += 2; continue; }
          if (next === 0xff) { pos += 1; continue; }
          break; // a real marker
        }
        pos++;
      }
      if (pos >= b.length) return null;
      kept.push(b.subarray(scanStart, pos));
      sawScan = true;
      continue; // the marker at `pos` is read by the loop
    } else if (marker === 0xe1) { // APP1: Exif / XMP. Dropped; only the orientation number is read.
      if (ascii(data, 0, 6) === "Exif\0\0" && orientation === 1) orientation = exifOrientation(data);
    } else if (marker === 0xe0) { // APP0: keep only a plain JFIF header (JFXX can hold a thumbnail)
      if (ascii(data, 0, 5) === "JFIF\0") kept.push(whole);
    } else if (marker === 0xe2) { // APP2: keep a colour profile (colours look right), drop the rest (MPF, FlashPix)
      if (ascii(data, 0, 12) === "ICC_PROFILE\0") kept.push(whole);
    } else if (marker === 0xee) { // APP14 "Adobe": colour transform, needed to show some files correctly
      if (ascii(data, 0, 5) === "Adobe") kept.push(whole);
    } else if (marker >= 0xe3 && marker <= 0xef) {
      // APP3 - APP15 (other metadata): dropped
    } else if (marker === 0xfe) {
      // comment: dropped
    } else {
      kept.push(whole); // tables and other picture structure
    }
    pos = segEnd;
  }

  if (!ended || !sawScan || width <= 0 || height <= 0) return null;
  if (orientation > 1) kept.splice(kept.length > 0 && kept[0][1] === 0xe0 ? 1 : 0, 0, orientationSegment(orientation));
  return { bytes: concat([Uint8Array.from([0xff, 0xd8]), ...kept, Uint8Array.from([0xff, 0xd9])]), width, height };
}

// ---------------------------------------------------------------- PNG

// Chunks that are kept. tEXt, zTXt, iTXt (text), eXIf (Exif), tIME, sPLT, hIST and unknown chunks are removed.
const PNG_KEEP = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "bKGD", "pHYs", "cICP", "acTL", "fcTL", "fdAT"]);

function cleanPng(b: Uint8Array): Cleaned | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 8 + 25 + 12 || !signature.every((v, i) => b[i] === v)) return null;
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  let pos = 8;
  let first = true;
  let width = 0;
  let height = 0;
  let sawData = false;

  while (pos + 12 <= b.length) {
    const length = u32be(b, pos);
    if (length > 0x7fffffff) return null;
    const type = ascii(b, pos + 4, pos + 8);
    if (!/^[A-Za-z]{4}$/.test(type)) return null;
    const total = 12 + length;
    if (pos + total > b.length) return null;
    if (first) {
      if (type !== "IHDR" || length !== 13) return null;
      width = u32be(b, pos + 8);
      height = u32be(b, pos + 12);
      first = false;
    }
    if (PNG_KEEP.has(type)) parts.push(b.subarray(pos, pos + total));
    if (type === "IDAT") sawData = true;
    pos += total;
    if (type === "IEND") {
      if (!sawData || width <= 0 || height <= 0) return null;
      return { bytes: concat(parts), width, height }; // anything after IEND is dropped
    }
  }
  return null; // no IEND: broken or truncated
}

// ---------------------------------------------------------------- WebP

const WEBP_KEEP = new Set(["VP8 ", "VP8L", "VP8X", "ALPH", "ANIM", "ANMF", "ICCP"]); // "EXIF" and "XMP " are removed

function cleanWebp(b: Uint8Array): Cleaned | null {
  if (b.length < 20 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 12) !== "WEBP") return null;
  const endAt = u32le(b, 4) + 8;
  if (endAt > b.length || endAt < 20) return null; // truncated file
  const chunks: Uint8Array[] = [];
  let canvasW = 0;
  let canvasH = 0;
  let imageW = 0;
  let imageH = 0;
  let sawImage = false;
  let pos = 12;

  while (pos + 8 <= endAt) {
    const type = ascii(b, pos, pos + 4);
    const size = u32le(b, pos + 4);
    const dataStart = pos + 8;
    const dataEnd = dataStart + size;
    const next = dataEnd + (size & 1); // chunks are padded to an even size
    if (dataEnd > endAt || next > endAt) return null;

    if (WEBP_KEEP.has(type)) {
      let chunk = b.subarray(pos, next);
      if (type === "VP8X") {
        if (size < 10) return null;
        chunk = b.slice(pos, next);
        chunk[8] &= ~0x0c; // the flags say "has Exif" (0x08) / "has XMP" (0x04): cleared
        canvasW = 1 + b[dataStart + 4] + (b[dataStart + 5] << 8) + (b[dataStart + 6] << 16);
        canvasH = 1 + b[dataStart + 7] + (b[dataStart + 8] << 8) + (b[dataStart + 9] << 16);
      } else if (type === "VP8L") {
        if (size < 5 || b[dataStart] !== 0x2f) return null;
        const bits = u32le(b, dataStart + 1);
        imageW = (bits & 0x3fff) + 1;
        imageH = (Math.floor(bits / 2 ** 14) & 0x3fff) + 1;
        sawImage = true;
      } else if (type === "VP8 ") {
        if (size < 10 || b[dataStart + 3] !== 0x9d || b[dataStart + 4] !== 0x01 || b[dataStart + 5] !== 0x2a) return null;
        imageW = u16le(b, dataStart + 6) & 0x3fff;
        imageH = u16le(b, dataStart + 8) & 0x3fff;
        sawImage = true;
      } else if (type === "ANMF") {
        sawImage = true;
      }
      chunks.push(chunk);
    }
    pos = next;
  }

  const width = canvasW || imageW;
  const height = canvasH || imageH;
  if (!sawImage || width <= 0 || height <= 0 || chunks.length === 0) return null;
  let body = 4; // "WEBP"
  for (const chunk of chunks) body += chunk.length;
  const head = Uint8Array.from([0x52, 0x49, 0x46, 0x46, body & 0xff, (body >>> 8) & 0xff, (body >>> 16) & 0xff, (body >>> 24) & 0xff, 0x57, 0x45, 0x42, 0x50]);
  return { bytes: concat([head, ...chunks]), width, height };
}

// ---------------------------------------------------------------- the one check the server action calls

/** The three numbers the check uses. Social uses `socialMedia`; photos pass their own (`photoMedia`, PHOTO_TODO 3). */
export type ImageLimits = { imageMaxBytes: number; maxSide: number; maxPixels: number };

/** Checks one uploaded picture (`bytes` = the whole file) and returns the CLEANED copy to save. `limits` defaults to the Social limits. */
export function checkSocialImage(input: Uint8Array | null | undefined, limits: ImageLimits = socialMedia): CheckedSocialImage {
  if (!input || input.length === 0) return { ok: false, error: "type" };
  if (input.length > limits.imageMaxBytes) return { ok: false, error: "size" };
  const real = sniffImage(input);
  if (real !== "jpg" && real !== "png" && real !== "webp") return { ok: false, error: "type" };

  const cleaned = real === "jpg" ? cleanJpeg(input) : real === "png" ? cleanPng(input) : cleanWebp(input);
  if (!cleaned) return { ok: false, error: "type" };
  if (cleaned.width > limits.maxSide || cleaned.height > limits.maxSide || cleaned.width * cleaned.height > limits.maxPixels) {
    return { ok: false, error: "pixels" };
  }
  return { ok: true, ext: real, mime: MIME[real], bytes: cleaned.bytes, width: cleaned.width, height: cleaned.height };
}
