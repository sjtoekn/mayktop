import Link from "next/link";
import { t } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { staffConfig } from "@/config/site";
import { requireAdmin } from "@/lib/admin";
import { loadSocialQueue } from "@/lib/social-review";
import SocialModerationBox, { type SocialModerationText } from "@/components/admin/SocialModerationBox";
import SocialExtraQueue from "@/components/admin/SocialExtraQueue";

// Error code -> text. "self" and "same" reuse the block texts of the community review page.
const ERROR_KEYS: Record<string, MessageKey> = {
  actor: "admin.err.actor",
  notfound: "admin.social.err.notfound",
  allowed: "admin.review.err.allowed",
  self: "admin.review.block.self",
  rule: "admin.social.err.rule",
  reason: "admin.err.reason",
  state: "admin.review.err.state",
  same: "admin.review.block.same",
};

function timeText(date: Date): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date) + " UTC";
}

const ruleLabel = (key: string) => (key ? t(`siteRule.${key}` as MessageKey) : "");

export default async function AdminSocialPage() {
  const me = await requireAdmin();
  const { reported, pending } = await loadSocialQueue(me.id);

  const errors: Record<string, string> = { other: t("admin.err.other") };
  for (const [code, key] of Object.entries(ERROR_KEYS)) errors[code] = t(key);
  const text: SocialModerationText = {
    rule: t("admin.social.rule"),
    reason: t("admin.social.reason", { min: "{min}" }),
    hide: t("admin.social.hide"),
    dismiss: t("admin.social.dismiss"),
    restore: t("admin.review.restore"),
    remove: t("admin.review.remove"),
    sure: {
      hide: t("admin.social.sure.hide"),
      dismiss: t("admin.social.sure.dismiss"),
      restore: t("admin.review.sure.restore"),
      remove: t("admin.review.sure.remove"),
    },
    back: t("admin.act.back"),
    working: t("admin.act.working"),
    done: t("admin.act.done"),
    errors,
  };
  const rules = staffConfig.siteRules.map((rule) => ({ key: rule.key, label: ruleLabel(rule.key) }));
  const limits = { minReason: staffConfig.minReasonLength, maxReason: staffConfig.maxReasonLength };

  return (
    <>
      <section className="ad-head">
        <h1 className="pc-title pc-title-lg">{t("admin.social.title")}</h1>
        <p className="pc-text">{t("admin.social.intro")}</p>
      </section>

      <section>
        <h2 className="pc-title">{t("admin.social.reports.title")}</h2>
        {reported.length === 0 ? (
          <p className="card ad-empty">{t("admin.social.reports.empty")}</p>
        ) : (
          reported.map((item) => (
            <section key={item.id} className="card ad-item">
              <div className="ad-profileTop">
                <div>
                  <h3 className="pc-title">{t("social.label")} #{item.id}</h3>
                  <p className="pc-meta">{t("admin.review.by", { name: item.author })}</p>
                </div>
                <div className="ad-badges">
                  <span className="pc-badge pc-badge-info">{t("admin.social.reportCount", { count: item.reports.length })}</span>
                </div>
              </div>
              <div className="ad-quote">
                <p>{item.text}</p>
              </div>
              {item.image && (
                <div className="sp-media">
                  {/* eslint-disable-next-line @next/next/no-img-element -- our own protected file (admins and logged-in people only) */}
                  <img src={item.image} alt={t("social.image.alt", { name: item.author })} loading="lazy" decoding="async" />
                </div>
              )}
              <ul>
                {item.reports.map((r, index) => (
                  <li key={index} className="pc-meta">
                    {t("admin.social.reportLine", { name: r.reporter, rule: ruleLabel(r.siteRule), reason: r.reason })} · {timeText(r.createdAt)}
                  </li>
                ))}
              </ul>
              <div className="ad-actionRow">
                <Link href={`/social/${item.id}`} className="btn btn-ghost btn-sm" target="_blank" rel="noopener">
                  {t("admin.review.view")}
                </Link>
              </div>
              {item.own ? (
                <div className="notice notice-info">{t("admin.review.block.self")}</div>
              ) : (
                <SocialModerationBox mode="hide" id={item.id} rules={rules} limits={limits} text={text} />
              )}
            </section>
          ))
        )}
      </section>

      <section>
        <h2 className="pc-title">{t("admin.social.pending.title")}</h2>
        {pending.length === 0 ? (
          <p className="card ad-empty">{t("admin.social.pending.empty")}</p>
        ) : (
          pending.map((item) => (
            <section key={item.id} className="card ad-item">
              <div className="ad-profileTop">
                <div>
                  <h3 className="pc-title">{t("social.label")} #{item.id}</h3>
                  <p className="pc-meta">{t("admin.review.by", { name: item.author })}</p>
                  <p className="pc-meta">
                    {item.hiddenBy && item.hiddenAt
                      ? t("admin.review.hiddenBy", { name: item.hiddenBy, date: timeText(item.hiddenAt) })
                      : item.hiddenAt
                        ? t("admin.review.hiddenOn", { date: timeText(item.hiddenAt) })
                        : ""}
                  </p>
                </div>
                <div className="ad-badges">
                  {item.overdue && <span className="pc-badge pc-badge-danger">{t("admin.review.overdue")}</span>}
                </div>
              </div>
              {item.text ? (
                <div className="ad-quote">
                  <p>{item.text}</p>
                </div>
              ) : (
                <p className="pc-meta">{t("admin.review.erased")}</p>
              )}
              {item.image && (
                <div className="sp-media">
                  {/* eslint-disable-next-line @next/next/no-img-element -- our own protected file (admins and logged-in people only) */}
                  <img src={item.image} alt={t("social.image.alt", { name: item.author })} loading="lazy" decoding="async" />
                </div>
              )}
              {item.siteRule && <p className="pc-meta">{t("admin.review.rule", { rule: ruleLabel(item.siteRule) })}</p>}
              {item.reason && <p className="ad-historyReason">{item.reason}</p>}
              {item.block ? (
                <div className="notice notice-info">{t(item.block === "self" ? "admin.review.block.self" : "admin.review.block.same")}</div>
              ) : (
                <SocialModerationBox mode="decide" id={item.id} rules={rules} limits={limits} text={text} />
              )}
            </section>
          ))
        )}
      </section>

      <SocialExtraQueue meId={me.id} />
    </>
  );
}
