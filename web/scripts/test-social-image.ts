// Tests for the picture of a Social post (patch-social-images): `npm run test:social-image`.
// No database needed. Files are written to a temporary folder (SOCIAL_MEDIA_DIR), which is removed at the end.
// The test pictures are built here byte by byte, with secrets planted in the metadata, to prove the secrets do not survive.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { socialMedia } from "../src/config/site";
import { checkSocialImage, fileFromSocialImageUrl, mimeOfSocialImage, SOCIAL_IMAGE_FILE_RE, socialImageUrl } from "../src/lib/social-image";
import { deleteSocialImages, saveSocialImage, socialMediaPath } from "../src/lib/social-image-storage";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "social-image-test-"));
process.env.SOCIAL_MEDIA_DIR = tmp;

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}

const bytes = (...values: (number | string | number[])[]) =>
  Uint8Array.from(values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : Array.isArray(v) ? v : [v])));
const cat = (...parts: Uint8Array[]) => Uint8Array.from(parts.flatMap((p) => [...p]));
const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const l32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
const has = (haystack: Uint8Array, needle: string) => Buffer.from(haystack).includes(needle);

// ---------------------------------------------------------------- builders
function segment(marker: number, data: Uint8Array): Uint8Array {
  return cat(bytes(0xff, marker, u16(data.length + 2)), data);
}

/** A JPEG-like file that has the right structure (the checks read the structure, not the pixels). */
function makeJpeg(opts: { width?: number; height?: number; exifOrientation?: number; icc?: boolean; noEoi?: boolean } = {}): Uint8Array {
  const width = opts.width ?? 40;
  const height = opts.height ?? 30;
  const parts: Uint8Array[] = [bytes(0xff, 0xd8)];
  parts.push(segment(0xe0, bytes("JFIF\0", 1, 1, 0, 0, 1, 0, 1, 0, 0)));
  // Exif, little endian, with a GPS marker text and an orientation entry
  const orientation = opts.exifOrientation ?? 6;
  const exif = bytes(
    "Exif\0\0", "II", 42, 0, 8, 0, 0, 0, // TIFF header, IFD0 at 8
    2, 0, // two entries
    0x0f, 0x01, 2, 0, 12, 0, 0, 0, 38, 0, 0, 0, // Make (text), points to byte 38
    0x12, 0x01, 3, 0, 1, 0, 0, 0, orientation, 0, 0, 0, // Orientation
    0, 0, 0, 0, // no next IFD
    "GPSSECRET-12.3456N-78.9012E\0",
  );
  parts.push(segment(0xe1, exif));
  parts.push(segment(0xe1, bytes("http://ns.adobe.com/xap/1.0/\0", "XMPSECRET-author-name")));
  parts.push(segment(0xed, bytes("Photoshop 3.0\0", "IPTCSECRET")));
  parts.push(segment(0xfe, bytes("COMMENTSECRET")));
  if (opts.icc) parts.push(segment(0xe2, bytes("ICC_PROFILE\0", 1, 1, "ICCDATA")));
  parts.push(segment(0xe2, bytes("MPF\0", "SECONDPICTURE")));
  parts.push(segment(0xdb, cat(bytes(0), new Uint8Array(64).fill(8)))); // DQT
  parts.push(segment(0xc0, bytes(8, u16(height), u16(width), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1))); // SOF0
  parts.push(segment(0xc4, bytes(0x00, new Array(16).fill(0), 0))); // DHT (structure only)
  parts.push(segment(0xda, bytes(3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0))); // SOS header
  parts.push(bytes(0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd0, 0x78, 0x9a)); // packed picture data with FF00 and a restart marker
  if (!opts.noEoi) parts.push(bytes(0xff, 0xd9));
  parts.push(bytes("TRAILINGSECRET"));
  return cat(...parts);
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  return cat(bytes(u32(data.length), type), data, bytes(0, 0, 0, 0)); // the checksum is not checked by the cleaner
}
function makePng(opts: { width?: number; height?: number; noEnd?: boolean } = {}): Uint8Array {
  const parts: Uint8Array[] = [bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)];
  parts.push(pngChunk("IHDR", bytes(u32(opts.width ?? 50), u32(opts.height ?? 20), 8, 2, 0, 0, 0)));
  parts.push(pngChunk("tEXt", bytes("Comment\0", "PNGTEXTSECRET")));
  parts.push(pngChunk("eXIf", bytes("II", 42, 0, "EXIFPNGSECRET")));
  parts.push(pngChunk("tIME", bytes(7, 234, 11, 8, 1, 2, 3)));
  parts.push(pngChunk("sRGB", bytes(0)));
  parts.push(pngChunk("IDAT", bytes(1, 2, 3, 4, 5, 6, 7, 8)));
  if (!opts.noEnd) parts.push(pngChunk("IEND", new Uint8Array(0)));
  parts.push(bytes("PNGTRAILINGSECRET"));
  return cat(...parts);
}

function webpChunk(type: string, data: Uint8Array): Uint8Array {
  return cat(bytes(type, l32(data.length)), data, data.length % 2 ? bytes(0) : new Uint8Array(0));
}
function makeWebp(opts: { truncate?: boolean } = {}): Uint8Array {
  const w = 100;
  const h = 50;
  const vp8x = webpChunk("VP8X", bytes(0x08 | 0x04 | 0x10, 0, 0, 0, (w - 1) & 0xff, 0, 0, (h - 1) & 0xff, 0, 0)); // Exif + XMP + alpha flags
  const bits = (w - 1) + (h - 1) * 2 ** 14;
  const vp8l = webpChunk("VP8L", bytes(0x2f, l32(bits), 1, 2, 3)); // odd size: padded
  const exif = webpChunk("EXIF", bytes("WEBPEXIFSECRET"));
  const xmp = webpChunk("XMP ", bytes("WEBPXMPSECRET"));
  const body = cat(bytes("WEBP"), vp8x, vp8l, exif, xmp);
  const file = cat(bytes("RIFF", l32(body.length)), body, bytes("WEBPTRAILINGSECRET"));
  return opts.truncate ? file.subarray(0, file.length - 40) : file;
}

// ---------------------------------------------------------------- JPEG
{
  const input = makeJpeg({ icc: true });
  const r = checkSocialImage(input);
  check("a JPEG is accepted", r.ok && r.ext === "jpg" && r.mime === "image/jpeg");
  if (r.ok) {
    check("JPEG size is read", r.width === 40 && r.height === 30);
    check("JPEG still starts and ends like a JPEG", r.bytes[0] === 0xff && r.bytes[1] === 0xd8 && r.bytes[r.bytes.length - 2] === 0xff && r.bytes[r.bytes.length - 1] === 0xd9);
    check("JPEG: GPS / camera text of the Exif is gone", !has(r.bytes, "GPSSECRET") && !has(r.bytes, "12.3456"));
    check("JPEG: XMP, IPTC and comments are gone", !has(r.bytes, "XMPSECRET") && !has(r.bytes, "IPTCSECRET") && !has(r.bytes, "COMMENTSECRET"));
    check("JPEG: a second hidden picture (MPF) is gone", !has(r.bytes, "SECONDPICTURE"));
    check("JPEG: bytes after the end of the picture are gone", !has(r.bytes, "TRAILINGSECRET"));
    check("JPEG: the JFIF header and the colour profile stay", has(r.bytes, "JFIF") && has(r.bytes, "ICC_PROFILE") && has(r.bytes, "ICCDATA"));
    check("JPEG: the packed picture data is kept exactly", Buffer.from(r.bytes).includes(Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd0, 0x78, 0x9a])));
    // The only Exif left is the 34-byte orientation segment
    const exifAt = Buffer.from(r.bytes).indexOf(Buffer.from("Exif\0\0", "latin1"));
    check("JPEG: only a small Exif with the orientation is left", exifAt > 0 && r.bytes[exifAt - 4] === 0xff && r.bytes[exifAt - 3] === 0xe1 && r.bytes[exifAt - 1] === 0x22);
    check("JPEG: the orientation (6) is kept, so a phone photo is not turned sideways", exifAt > 0 && r.bytes[exifAt + 6 + 8 + 2 + 9] === 6);
    check("JPEG: the cleaned copy is smaller than the upload", r.bytes.length < input.length);
  }
  const flat = checkSocialImage(makeJpeg({ exifOrientation: 1 }));
  check("JPEG with orientation 1: no Exif at all is left", flat.ok && !has(flat.bytes, "Exif"));
  const odd = checkSocialImage(makeJpeg({ exifOrientation: 9 }));
  check("JPEG with a nonsense orientation value: treated as 1, no Exif left", odd.ok && !has(odd.bytes, "Exif"));
}

// ---------------------------------------------------------------- PNG
{
  const r = checkSocialImage(makePng());
  check("a PNG is accepted", r.ok && r.ext === "png" && r.mime === "image/png");
  if (r.ok) {
    check("PNG size is read", r.width === 50 && r.height === 20);
    check("PNG: text, Exif and time chunks are gone", !has(r.bytes, "PNGTEXTSECRET") && !has(r.bytes, "EXIFPNGSECRET") && !has(r.bytes, "tIME") && !has(r.bytes, "tEXt") && !has(r.bytes, "eXIf"));
    check("PNG: picture chunks stay", has(r.bytes, "IHDR") && has(r.bytes, "IDAT") && has(r.bytes, "sRGB") && has(r.bytes, "IEND"));
    check("PNG: bytes after the end are gone", !has(r.bytes, "PNGTRAILINGSECRET"));
  }
  const open = checkSocialImage(makePng({ noEnd: true }));
  check("a PNG without its end is refused", !open.ok && open.error === "type");
}

// ---------------------------------------------------------------- WebP
{
  const r = checkSocialImage(makeWebp());
  check("a WebP is accepted", r.ok && r.ext === "webp" && r.mime === "image/webp");
  if (r.ok) {
    check("WebP size is read (from the canvas)", r.width === 100 && r.height === 50);
    check("WebP: Exif and XMP are gone", !has(r.bytes, "WEBPEXIFSECRET") && !has(r.bytes, "WEBPXMPSECRET") && !has(r.bytes, "EXIF") && !has(r.bytes, "XMP "));
    check("WebP: bytes after the end are gone", !has(r.bytes, "WEBPTRAILINGSECRET"));
    const riffSize = r.bytes[4] + r.bytes[5] * 256 + r.bytes[6] * 65536 + r.bytes[7] * 16777216;
    check("WebP: the declared size matches the file", riffSize + 8 === r.bytes.length);
    const at = Buffer.from(r.bytes).indexOf(Buffer.from("VP8X", "latin1"));
    check("WebP: the 'has Exif / has XMP' flags are cleared, alpha stays", at > 0 && (r.bytes[at + 8] & 0x0c) === 0 && (r.bytes[at + 8] & 0x10) === 0x10);
  }
  const cut = checkSocialImage(makeWebp({ truncate: true }));
  check("a cut WebP is refused", !cut.ok && cut.error === "type");
}

// ---------------------------------------------------------------- refused files
{
  const html = bytes("<html><script>alert(1)</script>", new Array(40).fill(32));
  const svg = bytes('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const exe = bytes("MZ", 0x90, 0, new Array(40).fill(0));
  const mp4 = bytes(0, 0, 0, 0x18, "ftypmp42", new Array(40).fill(0));
  const err = (b: Uint8Array | null | undefined) => { const r = checkSocialImage(b); return r.ok ? "ok" : r.error; };
  check("HTML is refused (type)", err(html) === "type");
  check("SVG is refused (type)", err(svg) === "type");
  check("a program is refused (type)", err(exe) === "type");
  check("a video is refused (type)", err(mp4) === "type");
  check("empty and missing are refused (type)", err(new Uint8Array(0)) === "type" && err(null) === "type" && err(undefined) === "type");
  check("a JPEG that only has the first bytes is refused (type)", err(bytes(0xff, 0xd8, 0xff, 0xe0, new Array(40).fill(0))) === "type");
  check("a JPEG without its end is refused (type)", err(makeJpeg({ noEoi: true })) === "type");
  check("a JPEG with a cut header is refused (type)", err(makeJpeg().subarray(0, 30)) === "type");

  const big = new Uint8Array(socialMedia.imageMaxBytes + 1);
  big.set([0xff, 0xd8, 0xff, 0xe0]);
  check("more than the size limit is refused (size)", err(big) === "size");
  check("exactly the size limit is not refused for size", err(big.subarray(0, socialMedia.imageMaxBytes)) !== "size");

  check("too many pixels in one side is refused (pixels)", err(makeJpeg({ width: socialMedia.maxSide + 1, height: 10 })) === "pixels");
  check("too many pixels in total is refused (pixels)", err(makeJpeg({ width: socialMedia.maxSide, height: Math.ceil(socialMedia.maxPixels / socialMedia.maxSide) + 1 })) === "pixels");
  check("a normal photo size is fine", err(makeJpeg({ width: 4000, height: 3000 })) === "ok");
}

// ---------------------------------------------------------------- addresses and files
{
  const file = "0123456789abcdef0123456789abcdef.png";
  check("a stored name is 32 hex characters + jpg / png / webp", SOCIAL_IMAGE_FILE_RE.test(file) && SOCIAL_IMAGE_FILE_RE.test(file.replace("png", "webp")));
  check("other names are not accepted", ["../etc/passwd", "a.png", file + ".exe", "0123456789ABCDEF0123456789ABCDEF.png", file.replace("png", "svg"), file.replace("png", "gif"), "/" + file].every((n) => !SOCIAL_IMAGE_FILE_RE.test(n)));
  check("address round trip", fileFromSocialImageUrl(socialImageUrl(file)) === file);
  check("addresses that are not ours give null", [null, undefined, 5, "https://evil.example/a.png", "/api/ad/media/" + file, "/api/social/media/../" + file, "/api/social/media/" + file + "x"].every((u) => fileFromSocialImageUrl(u) === null));
  check("mime from the extension", mimeOfSocialImage(file) === "image/png" && mimeOfSocialImage("a.jpg") === "image/jpeg" && mimeOfSocialImage("a.webp") === "image/webp" && mimeOfSocialImage("a.exe") === null);
  check("a path cannot be built from a bad name", socialMediaPath("../x.png") === null && socialMediaPath(file) === path.join(tmp, file));
}

async function storageTests() {
  const r = checkSocialImage(makePng());
  if (!r.ok) throw new Error("test picture should be fine");
  const url = await saveSocialImage(r.bytes, r.ext);
  const file = fileFromSocialImageUrl(url);
  check("saving gives one of our addresses", file !== null);
  const full = file ? socialMediaPath(file) : null;
  check("the file is on disk with the cleaned bytes", !!full && fs.existsSync(full) && Buffer.compare(fs.readFileSync(full), Buffer.from(r.bytes)) === 0);
  const second = await saveSocialImage(r.bytes, r.ext);
  check("every save gets a new random name", second !== url);

  await deleteSocialImages([null, undefined, "https://evil.example/x.png", "/api/ad/media/0123456789abcdef0123456789abcdef.png", "/api/social/media/../../x.png"]);
  check("foreign addresses are ignored, nothing is thrown", !!full && fs.existsSync(full));
  await deleteSocialImages([url, second, url]);
  check("deleting removes the files (twice is harmless)", !!full && !fs.existsSync(full) && fs.readdirSync(tmp).length === 0);
}

storageTests()
  .catch((error) => {
    console.error(error);
    failed += 1;
  })
  .finally(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) FAILED.`);
    process.exit(failed === 0 ? 0 : 1);
  });
