// The ad texts and the repeat window for the Shorts pages, built on the server (the same texts AdSlot.tsx uses).
import { adsConfig } from "@/config/site";
import { t } from "@/i18n";
import type { AdLabels } from "@/components/AdBox";

export function shortAdProps(): { adLabels: AdLabels; adNoRepeatMinutes: number } {
  const minutes = adsConfig.rotation.noRepeatMinutes;
  return {
    adNoRepeatMinutes: minutes,
    adLabels: {
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
      sponsored: t("ad.header.sponsored"),
    },
  };
}
