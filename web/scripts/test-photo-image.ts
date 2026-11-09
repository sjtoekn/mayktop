// Tests for the files of a photo (PHOTO_TODO 3): `npm run test:photo-image`.
// No database needed. Files are written to a temporary folder (PHOTO_MEDIA_DIR), which is removed at the end.
// The test pictures are made with sharp here, with a secret planted in the metadata, to prove the secret does not survive.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { photoMedia, socialMedia } from "../src/config/site";
import { isPhotoFullName, PHOTO_FILE_RE, photoFileUrl, photoFullNameOf, photoThumbName, photoThumbUrl } from "../src/lib/photo-file";
import { makePhotoFiles } from "../src/lib/photo-image";
import { checkSocialImage } from "../src/lib/social-image";
import { deletePhotoFiles, photoMediaPath, savePhotoFiles } from "../src/lib/photo-storage";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "photo-image-test-"));
process.env.PHOTO_MEDIA_DIR = tmp;

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}
const has = (data: Uint8Array, needle: string) => Buffer.from(data).includes(needle);
const isWebp = (d: Uint8Array) => Buffer.from(d.subarray(0, 4)).toString("latin1") === "RIFF" && Buffer.from(d.subarray(8, 12)).toString("latin1") === "WEBP";

async function jpeg(width: number, height: number, withSecret = true): Promise<Uint8Array> {
  let img = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } });
  if (withSecret) img = img.withExif({ IFD0: { ImageDescription: "SECRET-LOCATION-9876", Copyright: "SECRET-OWNER" } });
  return new Uint8Array(await img.jpeg().toBuffer());
}

async function main() {
  // ---------------------------------------------------------------- names
  const h = "b".repeat(32);
  check("full and thumbnail names are accepted", PHOTO_FILE_RE.test(`${h}.webp`) && PHOTO_FILE_RE.test(`${h}-t.webp`));
  check("path tricks and other types are refused", !["../x.webp", `${h}.jpg`, `${h}.webp/x`, `${h}-x.webp`, `${"B".repeat(32)}.webp`].some((n) => PHOTO_FILE_RE.test(n)));
  check("only a full name counts as Photo.file", isPhotoFullName(`${h}.webp`) && !isPhotoFullName(`${h}-t.webp`));
  check("thumbnail name and addresses", photoThumbName(`${h}.webp`) === `${h}-t.webp` && photoFullNameOf(`${h}-t.webp`) === `${h}.webp` && photoFileUrl(`${h}.webp`) === `/api/photos/media/${h}.webp` && photoThumbUrl(`${h}.webp`) === `/api/photos/media/${h}-t.webp`);
  check("photoMediaPath refuses a name that is not ours", photoMediaPath("../../etc/passwd") === null && photoMediaPath(`${h}.webp`) !== null);

  // ---------------------------------------------------------------- making the files
  const small = await makePhotoFiles(await jpeg(400, 300));
  check("a normal JPEG is accepted", small.ok);
  if (small.ok) {
    check("both files are WebP", isWebp(small.full) && isWebp(small.thumb));
    check("the secret in the Exif data does NOT survive (full copy and thumbnail)", !has(small.full, "SECRET") && !has(small.thumb, "SECRET") && !has(small.full, "9876"));
    check("a small picture is not enlarged", small.width === 400 && small.height === 300);
  }

  const big = await makePhotoFiles(await jpeg(3600, 2400, false));
  check("a big picture is accepted", big.ok);
  if (big.ok) {
    check("the full copy is shrunk to fullSide", Math.max(big.width, big.height) === photoMedia.fullSide);
    const tm = await sharp(Buffer.from(big.thumb)).metadata();
    check("the thumbnail is at most thumbSide", Math.max(tm.width ?? 0, tm.height ?? 0) <= photoMedia.thumbSide && (tm.width ?? 0) > 0);
  }

  const rotated = await makePhotoFiles(new Uint8Array(await sharp({ create: { width: 300, height: 200, channels: 3, background: "#336699" } }).withMetadata({ orientation: 6 }).jpeg().toBuffer()));
  check("camera rotation is applied (a sideways phone photo becomes upright)", rotated.ok && rotated.width === 200 && rotated.height === 300);

  const png = await makePhotoFiles(new Uint8Array(await sharp({ create: { width: 64, height: 64, channels: 3, background: "#fff" } }).png().toBuffer()));
  check("a PNG is accepted and saved as WebP", png.ok && isWebp(png.full));

  // ---------------------------------------------------------------- the 50 MB decision (PHOTO_TODO 1b, raised from 20 MB on 2026-11-08)
  check("the photo limit is 50 MB and the Social limit is still smaller", photoMedia.imageMaxBytes === 50 * 1024 * 1024 && socialMedia.imageMaxBytes < photoMedia.imageMaxBytes);
  const social = checkSocialImage(new Uint8Array(socialMedia.imageMaxBytes + 1));
  check("Social still refuses a file over ITS limit (default limits unchanged)", !social.ok && social.error === "size");
  const noise = new Uint8Array(await sharp({ create: { width: 2600, height: 2200, channels: 3, background: "#808080", noise: { type: "gaussian", mean: 128, sigma: 90 } } }).jpeg({ quality: 100 }).toBuffer());
  if (noise.length > socialMedia.imageMaxBytes && noise.length < photoMedia.imageMaxBytes) {
    const bigFile = await makePhotoFiles(noise);
    check(`a ${(noise.length / 1024 / 1024).toFixed(1)} MB photo (over the Social limit, under 50 MB) is accepted`, bigFile.ok);
  } else {
    console.log(`SKIP  big-file test (the test picture came out ${(noise.length / 1024 / 1024).toFixed(1)} MB, not between the two limits)`);
  }

  // ---------------------------------------------------------------- refusals
  const text = await makePhotoFiles(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"));
  check("an SVG / text file is refused (type)", !text.ok && text.error === "type");
  const junk = await makePhotoFiles(Uint8Array.from({ length: 2000 }, (_, i) => (i * 31) % 256));
  check("random bytes are refused (type)", !junk.ok && junk.error === "type");
  check("nothing is refused as 'ok' for an empty or missing file", !(await makePhotoFiles(new Uint8Array(0))).ok && !(await makePhotoFiles(null)).ok);
  const oversize = await makePhotoFiles(new Uint8Array(photoMedia.imageMaxBytes + 1));
  check("a file over the size limit is refused (size)", !oversize.ok && oversize.error === "size");
  const truncated = (await jpeg(800, 600)).subarray(0, 300);
  const cut = await makePhotoFiles(truncated);
  check("a cut-off JPEG is refused", !cut.ok);

  // ---------------------------------------------------------------- storage
  if (small.ok) {
    const name = await savePhotoFiles(small.full, small.thumb);
    const t = photoThumbName(name);
    check("savePhotoFiles keeps a random full name and a derived thumbnail name", isPhotoFullName(name));
    check("both files exist on disk", fs.existsSync(path.join(tmp, name)) && fs.existsSync(path.join(tmp, t)));
    await deletePhotoFiles([name, "../../x", null, undefined]);
    check("deletePhotoFiles removes both files and ignores names that are not ours", !fs.existsSync(path.join(tmp, name)) && !fs.existsSync(path.join(tmp, t)));
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(failed === 0 ? "\nAll photo-image tests passed." : `\n${failed} test(s) FAILED.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
