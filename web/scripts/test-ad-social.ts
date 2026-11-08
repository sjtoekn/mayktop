// Tests for the Social ad slot (ADS_PLAN Session S): `npm run test:ad-social`. No database needed.
import { adsConfig } from "../src/config/site";
import { cleanAdInput } from "../src/lib/ad-input";
import { FEED_AD_AFTER, SOCIAL_AD_AFTER, isFeedAdPosition, isSocialAdPosition, positionsAreValid } from "../src/lib/ad-positions";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}

const NOW = new Date(Date.UTC(2026, 10, 9, 10, 0));
const good = {
  format: "TEXT", slot: "SOCIAL_FEED", community: "", title: "Fresh coffee delivered",
  body: "Small-batch beans, roasted this week and sent to your door.",
  url: "https://example.com/coffee", email: "shop@example.com", start: "", agree: true,
};

check("SOCIAL_FEED is a known slot", (adsConfig.slots as readonly string[]).includes("SOCIAL_FEED"));
{
  const r = cleanAdInput(good, NOW);
  check("a Social feed ad passes", r.ok && r.value.slot === "SOCIAL_FEED");
}
{
  const r = cleanAdInput({ ...good, community: "cooking" }, NOW);
  check("a community is ignored for a Social feed ad (Social has no communities)", r.ok && r.value.communitySlug === null);
}
{
  const r = cleanAdInput({ ...good, slot: "FEED", community: "cooking" }, NOW);
  check("a normal feed ad keeps its community", r.ok && r.value.communitySlug === "cooking");
}
check("an unknown slot is still refused", (() => { const r = cleanAdInput({ ...good, slot: "SOCIAL" }, NOW); return !r.ok && r.error === "slot"; })());
check("all three formats are allowed in the Social feed", (["TEXT", "IMAGE", "VIDEO"] as const).every((f) => cleanAdInput({ ...good, format: f }, NOW).ok));

check("feed positions follow the rule (never first, 3 apart, max 2)", positionsAreValid(FEED_AD_AFTER));
check("Social positions follow the same rule", positionsAreValid(SOCIAL_AD_AFTER));
check("the rule check itself refuses first place, 3 ads, and ads too close", !positionsAreValid([0, 5]) && !positionsAreValid([1, 5, 9]) && !positionsAreValid([2, 4]));
check("position helpers", isSocialAdPosition(SOCIAL_AD_AFTER[0]) && !isSocialAdPosition(0) && isFeedAdPosition(FEED_AD_AFTER[1]) && !isFeedAdPosition(0));
const shownInFirstTwelve = Array.from({ length: 12 }, (_, i) => i).filter(isSocialAdPosition).length;
check("at most 2 Social ads on one screen of 12 posts", shownInFirstTwelve <= 2);

console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
