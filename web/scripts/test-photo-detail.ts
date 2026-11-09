// Tests for the small rules of the photo page (PHOTO_TODO 6): `npm run test:photo-detail`. No database, no disk.
import { photoCategories } from "../src/config/site";
import { isPhotoId, parsePhotoId, photoCategoryKeyOf, photoDay } from "../src/lib/photo-detail-rules";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}

check("id: plain numbers are accepted", parsePhotoId("1") === 1 && parsePhotoId("123") === 123 && parsePhotoId("2147483647") === 2147483647);
check("id: other spellings of a number are refused (one photo, one address)", ["012", "0", "-1", "+1", "1e3", "12.0", " 12", "12 ", "0x1", "１２"].every((v) => parsePhotoId(v) === null));
check("id: a number that does not fit the database, and text, are refused", ["2147483648", "99999999999", "", "abc", "12abc", "1/2"].every((v) => parsePhotoId(v) === null));
check("id: not a string is refused", [undefined, null, 5, ["1"], {}].every((v) => parsePhotoId(v) === null));

check("id as a number: whole numbers from 1 up to the database limit are accepted", [1, 2, 123, 2147483647].every((v) => isPhotoId(v)));
check("id as a number: zero, negative, decimal, too big, NaN, Infinity, text and null are refused", [0, -1, 1.5, 2147483648, NaN, Infinity, -Infinity, "5", null, undefined, true, {}].every((v) => !isPhotoId(v)));

check("category: every key of the list is kept", photoCategories.every((key) => photoCategoryKeyOf(key) === key));
check("category: an unknown, empty or wrong-case stored value is shown as 'other'", ["cars", "", "Nature", "constructor", "__proto__"].every((v) => photoCategoryKeyOf(v) === "other"));
check("category: a value that is not text is shown as 'other'", [null, undefined, 5, {}].every((v) => photoCategoryKeyOf(v) === "other"));

check("day: the date is written as year-month-day in UTC", photoDay(new Date("2026-11-08T23:59:59Z")) === "2026-11-08" && photoDay(new Date("2026-01-02T00:00:00Z")) === "2026-01-02");

console.log(failed === 0 ? "\nAll photo-detail tests passed." : `\n${failed} test(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
