import { adsConfig } from "@/config/site";
import { t } from "@/i18n";
import AdBox from "@/components/AdBox";

// An ad slot. Always clearly labelled "Ad", fixed size, never a pop-up (PROJECT.md section 5).
// The ads themselves come from the database: see AdBox.tsx (picking and counting), src/lib/queries.ts
// getAdPool (fair rotation) and ADS_PLAN.md.
//
// Feed ads: a LIMITED number of fixed positions, set in src/lib/ad-positions.ts (re-exported here, so the
// pages keep importing `isFeedAdPosition` from this file). The Social feed has its own positions and its own
// look (variant "social", ADS_PLAN decision 11).
export { FEED_AD_AFTER, SOCIAL_AD_AFTER, isFeedAdPosition, isSocialAdPosition } from "@/lib/ad-positions";

export default function AdSlot({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "feed" | "social";
}) {
  const minutes = adsConfig.rotation.noRepeatMinutes;
  return (
    <AdBox
      variant={variant}
      noRepeatMinutes={minutes}
      labels={{
        label: t("ad.label"),
        badge: t("ad.badge"),
        why: t("ad.why"),
        whyBody: t("ad.why.body"),
        remember: t("ad.why.remember", { minutes }),
        rememberOn: t("ad.why.remember.on"),
        blocked: t("ad.why.blocked"),
        houseTitle: t("ad.house.title"),
        houseBody: t("ad.house.body"),
        advertiser: t("ad.social.advertiser"),
      }}
    />
  );
}
