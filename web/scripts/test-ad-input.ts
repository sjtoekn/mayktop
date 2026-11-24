// Tests for the ad submit form checks (ADS_PLAN Session 3): `npm run test:ad-input`. No database needed.
import { adsConfig } from "../src/config/site";
import { checkSubmitLimits, cleanAdInput, cleanEmail, cleanHttpsUrl, cleanLine, findBlockedPhrase, hasWebAddress, parseDay } from "../src/lib/ad-input";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}

const NOW = new Date(Date.UTC(2026, 10, 7, 15, 30)); // 2026-11-07 15:30 UTC
const good = {
  format: "TEXT",
  slot: "SIDEBAR",
  community: "",
  title: "Fresh coffee delivered",
  body: "Small-batch beans, roasted this week and sent to your door.",
  url: "https://example.com/coffee?ref=falvenco",
  email: "shop@example.com",
  start: "",
  agree: true,
};
const err = (patch: Record<string, unknown>) => {
  const r = cleanAdInput({ ...good, ...patch }, NOW);
  return r.ok ? "ok" : r.error;
};

// the good form
{
  const r = cleanAdInput(good, NOW);
  check("a good text ad passes", r.ok);
  check("no start date = null, any community = null", r.ok && r.value.startDate === null && r.value.communitySlug === null);
}

// format / slot
check("IMAGE is open (Session 3b)", err({ format: "IMAGE" }) === "ok");
check("VIDEO is open (Session 3b)", err({ format: "VIDEO" }) === "ok");
check("an unknown format is refused", err({ format: "CAROUSEL" }) === "format");
check("unknown format refused", err({ format: "GIF" }) === "format");
check("FEED slot passes", err({ slot: "FEED" }) === "ok");
check("unknown slot refused", err({ slot: "POPUP" }) === "slot");

// shape
check("not an object", cleanAdInput(null, NOW).ok === false);
check("a number instead of text", err({ title: 5 }) === "type");
check("missing agree tick", err({ agree: false }) === "agree");
check("agree must be exactly true", err({ agree: "yes" }) === "agree");
check("bad community slug", err({ community: "../etc" }) === "type");
check("community slug is lower-cased", (() => { const r = cleanAdInput({ ...good, community: " Cooking " }, NOW); return r.ok && r.value.communitySlug === "cooking"; })());

// title / body
check("title too short", err({ title: "ab" }) === "title");
check("title too long", err({ title: "x".repeat(adsConfig.titleMaxLength + 1) }) === "title");
check("title of only invisible characters", err({ title: "\u200B\u200B\u200B\u200B" }) === "title");
check("body too short", err({ body: "short" }) === "body");
check("body too long", err({ body: "x".repeat(adsConfig.bodyMaxLength + 1) }) === "body");
check("new lines in the text become one space", cleanLine("a\n\n b\t c") === "a b c");
check("bidi override characters are removed", cleanLine("abc\u202Edef") === "abc def");
check("Sinhala joiner (ZWJ) is kept", cleanLine("ශ්\u200Dරී ලංකා").includes("\u200D"));
check("a web address in the text is refused", err({ body: "Visit https://example.com for the best coffee in town" }) === "textlink");
check("www in the title is refused", err({ title: "Shop at www.example.lk" }) === "textlink");
check("example.com written in text is refused", hasWebAddress("see example.com now"));
check("a normal sentence is not a web address", !hasWebAddress("Great deals. Shop now and save"));

// blocked phrases
check("blocked phrase found (case and spacing)", findBlockedPhrase("Get   RICH quick with us") === "get rich quick");
check("blocked phrase refused in a form", err({ body: "Guaranteed returns of 50% every month, join today" }) === "words");
check("phrase is reported", (() => { const r = cleanAdInput({ ...good, body: "Guaranteed returns of 50% every month, join today" }, NOW); return !r.ok && r.phrase === "guaranteed returns"; })());

// link
check("https link ok", cleanHttpsUrl("https://example.com/a?b=1") !== null);
check("http link refused", cleanHttpsUrl("http://example.com") === null);
check("javascript: refused", cleanHttpsUrl("javascript:alert(1)") === null);
check("login in the address refused", cleanHttpsUrl("https://trusted.com@evil.example/") === null);
check("localhost refused", cleanHttpsUrl("https://localhost/") === null);
check("host without a dot refused", cleanHttpsUrl("https://intranet/") === null);
check("bare IPv4 refused", cleanHttpsUrl("https://192.168.1.10/") === null);
check("IPv6 refused", cleanHttpsUrl("https://[::1]/") === null);
check(".local refused", cleanHttpsUrl("https://printer.local/") === null);
check("odd port refused", cleanHttpsUrl("https://example.com:8443/") === null);
check("space inside refused", cleanHttpsUrl("https://exa mple.com/") === null);
check("very long address refused", cleanHttpsUrl("https://example.com/" + "a".repeat(adsConfig.urlMaxLength)) === null);
check("not a string refused", cleanHttpsUrl(42) === null);
check("bad link in the form", err({ url: "ftp://example.com" }) === "url");

// email
check("email ok", cleanEmail("a.b+c@example.co.uk") === "a.b+c@example.co.uk");
check("email without @ refused", cleanEmail("example.com") === null);
check("email with two @ refused", cleanEmail("a@b@example.com") === null);
check("email with a space refused", cleanEmail("a b@example.com") === null);
check("email without a dot refused", cleanEmail("a@example") === null);
check("bad email in the form", err({ email: "nope" }) === "email");

// dates
check("parseDay real date", parseDay("2026-12-01")?.toISOString() === "2026-12-01T00:00:00.000Z");
check("parseDay impossible date", parseDay("2026-02-30") === null);
check("parseDay wrong shape", parseDay("1/2/2026") === null);
check("start today is allowed", err({ start: "2026-11-07" }) === "ok");
check("start in the past refused", err({ start: "2026-11-06" }) === "start");
check("start 90 days ahead is allowed", err({ start: "2027-02-05" }) === "ok");
check("start 91 days ahead refused", err({ start: "2027-02-06" }) === "start");
check("start that is not a date refused", err({ start: "soon" }) === "start");
check("start is saved at UTC midnight", (() => { const r = cleanAdInput({ ...good, start: "2026-12-01" }, NOW); return r.ok && r.value.startDate?.toISOString() === "2026-12-01T00:00:00.000Z"; })());

// submit limits
check("limits: fine", checkSubmitLimits(0, 0) === "ok");
check("limits: too many waiting", checkSubmitLimits(adsConfig.submit.maxWaiting, 0) === "waiting");
check("limits: too many today", checkSubmitLimits(0, adsConfig.submit.maxPerDay) === "day");
check("limits: one below each limit is fine", checkSubmitLimits(adsConfig.submit.maxWaiting - 1, adsConfig.submit.maxPerDay - 1) === "ok");

console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
