// Tests for the picture / video checks and the file storage of ads (ADS_PLAN Session 3b): `npm run test:ad-media`.
// No database needed. Files are written to a temporary folder (AD_MEDIA_DIR), which is removed at the end.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { adsConfig } from "../src/config/site";
import { checkMedia, fileFromMediaUrl, mediaNeeds, MEDIA_FILE_RE, mediaUrl, sniffImage, sniffVideo } from "../src/lib/ad-media";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ad-media-test-"));
process.env.AD_MEDIA_DIR = tmp;

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}

const bytes = (...values: (number | string)[]) =>
  Uint8Array.from(values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v])));
const pad = (head: Uint8Array, total = 64) => {
  const out = new Uint8Array(Math.max(total, head.length));
  out.set(head);
  return out;
};

const JPEG = pad(bytes(0xff, 0xd8, 0xff, 0xe0));
const PNG = pad(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a));
const WEBP = pad(bytes("RIFF", 0, 0, 0, 0, "WEBP"));
const MP4 = pad(bytes(0, 0, 0, 0x18, "ftypmp42"));
const WEBM = pad(bytes(0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81, 0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84, "webm"));
const EXE = pad(bytes("MZ", 0x90, 0));
const HTML = pad(bytes("<html><script>alert(1)</script>"));

// real content
check("JPEG is a picture", sniffImage(JPEG) === "jpg");
check("PNG is a picture", sniffImage(PNG) === "png");
check("WebP is a picture", sniffImage(WEBP) === "webp");
check("MP4 is a video", sniffVideo(MP4) === "mp4");
check("WebM is a video", sniffVideo(WEBM) === "webm");
check("an EBML file that is not webm (e.g. mkv) is not accepted", sniffVideo(pad(bytes(0x1a, 0x45, 0xdf, 0xa3, "matroska"))) === null);
check("a program is neither", sniffImage(EXE) === null && sniffVideo(EXE) === null);
check("HTML is neither (no script can be served as a picture)", sniffImage(HTML) === null && sniffVideo(HTML) === null);
check("a video is not accepted as a picture, nor a picture as a video", checkMedia("image", MP4).ok === false && checkMedia("video", PNG).ok === false);
check("empty / missing file", checkMedia("image", new Uint8Array(0)).ok === false && checkMedia("video", null).ok === false);
{
  const r = checkMedia("image", HTML);
  check("wrong content gives media-type", !r.ok && r.error === "media-type");
  const m = checkMedia("image", null);
  check("missing gives media-missing", !m.ok && m.error === "media-missing");
}

// sizes
{
  const bigImage = new Uint8Array(adsConfig.media.imageUploadMaxBytes + 1);
  bigImage.set(JPEG);
  const r = checkMedia("image", bigImage);
  check("a picture over the limit gives media-size", !r.ok && r.error === "media-size");
  const okImage = new Uint8Array(adsConfig.media.imageUploadMaxBytes);
  okImage.set(JPEG);
  check("a picture exactly at the limit is fine", checkMedia("image", okImage).ok === true);
  const bigVideo = new Uint8Array(adsConfig.media.videoMaxBytes + 1);
  bigVideo.set(MP4);
  const v = checkMedia("video", bigVideo);
  check("a video over the limit gives media-size", !v.ok && v.error === "media-size");
}

// what each format needs
check("TEXT needs no file", JSON.stringify(mediaNeeds("TEXT")) === '{"image":false,"video":false}');
check("IMAGE needs a picture", JSON.stringify(mediaNeeds("IMAGE")) === '{"image":true,"video":false}');
check("VIDEO needs a video and a poster picture", JSON.stringify(mediaNeeds("VIDEO")) === '{"image":true,"video":true}');

// addresses
{
  const good = "0123456789abcdef0123456789abcdef.png";
  check("our own address is recognised", fileFromMediaUrl(mediaUrl(good)) === good);
  check("an outside address is refused", fileFromMediaUrl("https://evil.example/x.png") === null);
  check("a path trick is refused", fileFromMediaUrl("/api/ad/media/../../etc/passwd") === null && fileFromMediaUrl("/api/ad/media/a.png") === null);
  check("an unknown extension is refused", !MEDIA_FILE_RE.test("0123456789abcdef0123456789abcdef.exe") && !MEDIA_FILE_RE.test("0123456789ABCDEF0123456789ABCDEF.png"));
}

// storage
async function storage() {
  const { adMediaPath, deleteAdFiles, saveAdFile } = await import("../src/lib/ad-storage");
  const url = await saveAdFile(JPEG, "jpg");
  const file = fileFromMediaUrl(url);
  check("saved file gets one of OUR addresses with a random name", file !== null);
  const full = file ? adMediaPath(file) : null;
  check("the file is inside the storage folder", full !== null && full.startsWith(tmp) && fs.existsSync(full));
  check("the content was stored unchanged", full !== null && Buffer.compare(fs.readFileSync(full), Buffer.from(JPEG)) === 0);
  const url2 = await saveAdFile(JPEG, "jpg");
  check("two saves never get the same name", url !== url2);
  check("a name outside our pattern has no path", adMediaPath("../x.png") === null && adMediaPath("notahexname.png") === null);
  await deleteAdFiles([url, url2, "https://evil.example/x.png", null, undefined, "/api/ad/media/../../x"]);
  check("delete removes our files and ignores everything else", full !== null && !fs.existsSync(full) && fs.readdirSync(tmp).length === 0);
}

storage()
  .catch((error) => {
    console.error(error);
    failed += 1;
  })
  .finally(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) FAILED.`);
    process.exit(failed === 0 ? 0 : 1);
  });
