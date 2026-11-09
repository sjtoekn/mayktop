// Tests of the small rules of the photo page extras (PHOTO_TODO 6b): `npm run test:photo-page`. No database.
import { photoDateText, photoDownloadName, photoInitials, photoMegapixels, photoMoreLimit, photoOrientation, photoThumbFile } from "../src/lib/photo-detail-rules";

let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed++;
    console.log(`FAIL  ${name}\n      ${error instanceof Error ? error.message : String(error)}`);
  }
}
function eq<T>(actual: T, expected: T) {
  if (actual !== expected) throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

test("orientation: wider is landscape, taller is portrait, equal is square", () => {
  eq(photoOrientation(600, 420), "landscape");
  eq(photoOrientation(420, 600), "portrait");
  eq(photoOrientation(500, 500), "square");
});

test("megapixels: one decimal, never below 0.1", () => {
  eq(photoMegapixels(600, 420), "0.3");
  eq(photoMegapixels(4000, 3000), "12.0");
  eq(photoMegapixels(1, 1), "0.1");
  eq(photoMegapixels(Number.NaN, 10), "0.1");
});

test("thumbnail name: our files get -t.webp, anything else is unchanged", () => {
  const hex = "90a2d54c89a57dd92e39a92f0ab2e7b5";
  eq(photoThumbFile(`${hex}.webp`), `${hex}-t.webp`);
  eq(photoThumbFile(`${hex}.jpg`), `${hex}-t.webp`);
  eq(photoThumbFile("../secret.webp"), "../secret.webp");
  eq(photoThumbFile(`${hex}-t.webp`), `${hex}-t.webp`);
});

test("initials: up to two letters, upper case", () => {
  eq(photoInitials("SJ Ethan"), "SE");
  eq(photoInitials("sjethan"), "S");
  eq(photoInitials("  maya   lee  kim "), "ML");
  eq(photoInitials(""), "");
});

test("more from the photographer: a small fixed number", () => {
  eq(photoMoreLimit, 6);
});

test("date text: day month year in the reader's language, UTC", () => {
  const d = new Date("2026-11-05T23:30:00Z");
  eq(photoDateText(d, "en"), "5 November 2026");
  eq(photoDateText(d, "fr"), "5 novembre 2026");
  eq(photoDateText(d, "not a language"), "2026-11-05");
});

test("download name: plain photo-<number>.<extension>, never the title", () => {
  const hex = "90a2d54c89a57dd92e39a92f0ab2e7b5";
  eq(photoDownloadName(12, `${hex}.webp`), "photo-12.webp");
  eq(photoDownloadName(7, `${hex}.jpg`), "photo-7.jpg");
  eq(photoDownloadName(7, "weird"), "photo-7");
});

if (failed > 0) {
  console.log(`\n${failed} test(s) failed.`);
  process.exit(1);
}
console.log("\nAll photo-page tests passed.");
