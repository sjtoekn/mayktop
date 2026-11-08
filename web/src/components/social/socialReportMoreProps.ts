// The props of <SocialReportMore> for a reply or an account, built on the server (the texts are translated here).
// One place, used by SocialReplyList and by the Social profile page.
import { socialReportConfig, staffConfig } from "@/config/site";
import { t } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import type { SocialReportMoreText } from "@/components/social/SocialReportMore";

export function socialReportMoreProps(kind: "reply" | "account"): {
  rules: { key: string; label: string }[];
  limits: { min: number; max: number };
  text: SocialReportMoreText;
} {
  const reply = kind === "reply";
  return {
    rules: staffConfig.siteRules.map((rule) => ({ key: rule.key, label: t(`siteRule.${rule.key}` as MessageKey) })),
    limits: { min: socialReportConfig.minReason, max: socialReportConfig.maxReason },
    text: {
      report: t(reply ? "social.report" : "social.report.account"),
      rule: t("social.report.rule"),
      reason: t(reply ? "social.report.reply.reason" : "social.report.account.reason"),
      submit: t("social.report.submit"),
      cancel: t("social.report.cancel"),
      sending: t("social.report.sending"),
      done: t(reply ? "social.report.reply.done" : "social.report.account.done"),
      already: t(reply ? "social.report.reply.already" : "social.report.account.already"),
      login: t("social.report.login"),
      tooMany: t("social.report.toomany"),
      invalid: t("social.report.invalid"),
      error: t("social.report.error"),
    },
  };
}
