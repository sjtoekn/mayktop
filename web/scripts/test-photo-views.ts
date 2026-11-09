// Tests of the photo view rules (PHOTO_TODO 6c): `npm run test:photo-views`. No database.
import { firstPhotoViewInWindow } from "../src/lib/photo-views";
import { firstViewInWindow, resetViewMemory, VIEW_SEEN_HOURS } from "../src/lib/social-views";

let failed = 0;
function test(name: string, fn: () => void) {
  resetViewMemory();
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

const T0 = 1_800_000_000_000;
const HOUR = 60 * 60 * 1000;

test("the first view of a photo by a person counts, a repeat does not", () => {
  eq(firstPhotoViewInWindow("u1", 12, T0), true);
  eq(firstPhotoViewInWindow("u1", 12, T0 + HOUR), false);
});

test("another person, or another photo, counts on its own", () => {
  eq(firstPhotoViewInWindow("u1", 12, T0), true);
  eq(firstPhotoViewInWindow("u2", 12, T0), true);
  eq(firstPhotoViewInWindow("u1", 13, T0), true);
});

test("after the window the same person counts again", () => {
  eq(firstPhotoViewInWindow("u1", 12, T0), true);
  eq(firstPhotoViewInWindow("u1", 12, T0 + (VIEW_SEEN_HOURS - 1) * HOUR), false);
  eq(firstPhotoViewInWindow("u1", 12, T0 + VIEW_SEEN_HOURS * HOUR), true);
});

test("photo 12 and Social post 12 do not share memory", () => {
  eq(firstViewInWindow("u1", 12, T0), true); // a Social post
  eq(firstPhotoViewInWindow("u1", 12, T0), true); // a photo with the same number
  eq(firstViewInWindow("u1", 12, T0 + HOUR), false);
  eq(firstPhotoViewInWindow("u1", 12, T0 + HOUR), false);
});

if (failed > 0) {
  console.log(`\n${failed} test(s) failed.`);
  process.exit(1);
}
console.log("\nAll photo-view tests passed.");
