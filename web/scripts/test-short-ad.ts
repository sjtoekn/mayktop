// npm run test:short-ad : where the ad cards go between shorts (pure rules, no database).
import assert from "node:assert/strict";
import { buildSlides, shortIndexOfSlide } from "../src/lib/short-feed-rules";

const shape = (n: number, every: number, on: boolean) =>
  buildSlides(n, every, on).map((s) => (s.kind === "ad" ? "A" : "s")).join("");

assert.equal(shape(8, 5, false), "ssssssss", "no ad running: no ad card");
assert.equal(shape(8, 5, true), "sssssAsss", "one ad after the 5th short");
assert.equal(shape(16, 5, true), "sssssAsssssAsssssAs", "an ad after every 5th short");
assert.equal(shape(5, 5, true), "sssss", "never at the very end");
assert.equal(shape(6, 5, true), "sssssAs", "once a short follows, the ad appears");
assert.equal(shape(0, 5, true), "", "empty list");
assert.equal(shape(10, 2, true), "ssssssssss", "closer than 3 apart: no ads");
assert.equal(shape(10, 0, true), "ssssssssss", "0 = no ads");
assert.equal(shape(10, 3.5, true), "ssssssssss", "not a whole number: no ads");
assert.equal(shape(7, 3, true), "sssAsssAs", "at least 3 shorts between two ads");

// shorts keep their order and none is lost or doubled
const slides = buildSlides(16, 5, true);
const shortOrder = slides.flatMap((s) => (s.kind === "short" ? [s.shortIndex] : []));
assert.deepEqual(shortOrder, Array.from({ length: 16 }, (_, i) => i));
assert.equal(slides[0].kind, "short", "an ad never opens the list");

// an ad card counts as the short before it (for "load the next page")
assert.equal(shortIndexOfSlide(slides, 4), 4);
assert.equal(shortIndexOfSlide(slides, 5), 4, "slide 5 is the ad after short 4");
assert.equal(shortIndexOfSlide(slides, 6), 5);
assert.equal(shortIndexOfSlide(slides, 999), 0, "out of range is safe");

console.log("test:short-ad OK");
