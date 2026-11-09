// Tests for the rules of the /photos grid (PHOTO_TODO 5): `npm run test:photo-feed`. No database, no disk.
import { PHOTO_ROW_HEIGHT, parsePhotoBefore, photoTileStyle } from "../src/lib/photo-feed-rules";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}

// ---------------------------------------------------------------- the cursor
check("cursor: plain digits are a cursor", parsePhotoBefore("123") === 123 && parsePhotoBefore("1") === 1);
check("cursor: nothing, empty and not-a-string mean the first page", [undefined, null, "", 5, ["1", "2"], {}].every((v) => parsePhotoBefore(v) === null));
check("cursor: zero, negative, decimal, exponent, sign and trailing text mean the first page", ["0", "-5", "1.5", "1e3", "+4", "12abc", " 12", "12 ", "0x10", "００１"].every((v) => parsePhotoBefore(v) === null));
check("cursor: a number that does not fit the database id means the first page", parsePhotoBefore("2147483648") === null && parsePhotoBefore("99999999999") === null && parsePhotoBefore("2147483647") === 2147483647);

// ---------------------------------------------------------------- the tile layout
check("tile: a square picture", (() => { const s = photoTileStyle(1000, 1000); return s.grow === 100 && s.basis === PHOTO_ROW_HEIGHT && s.ratioPercent === 100; })());
check("tile: a 3:2 landscape picture is wider than a square and keeps its shape", (() => { const s = photoTileStyle(3000, 2000); return s.grow === 150 && s.basis === 300 && s.ratioPercent === 66.67; })());
check("tile: a portrait picture is narrower than a square", (() => { const s = photoTileStyle(2000, 3000); return s.grow === 67 && s.basis === 133 && s.ratioPercent === 150; })());
check("tile: a very wide picture is limited to a ratio of 3", (() => { const s = photoTileStyle(30000, 1000); return s.grow === 300 && s.basis === 3 * PHOTO_ROW_HEIGHT; })());
check("tile: a very tall picture is limited to a ratio of 1/3", (() => { const s = photoTileStyle(1000, 30000); return s.grow === 33 && s.ratioPercent === 300; })());
check("tile: a size that cannot be used gives a square", [photoTileStyle(0, 100), photoTileStyle(100, 0), photoTileStyle(-5, 10), photoTileStyle(NaN, 10), photoTileStyle(10, Infinity)].every((s) => s.grow === 100 && s.ratioPercent === 100));
check("tile: the row height changes the basis only", (() => { const a = photoTileStyle(2000, 1000, 100); return a.basis === 200 && a.grow === 200 && a.ratioPercent === 50; })());

console.log(failed === 0 ? "\nAll photo-feed tests passed." : `\n${failed} test(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
