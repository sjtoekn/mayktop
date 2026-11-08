import Link from "next/link";
import { t } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { staffConfig } from "@/config/site";
import { loadSocialMoreQueue } from "@/lib/social-reply-review";
import SocialItemModerationBox, { type SocialItemModerationText } from "@/components/admin/SocialItemModerationBox";

// The extra sections of /admin/social (patch-social-report-more): reported REPLIES, hidden replies waiting for a second
// admin, and reported ACCOUNTS. Same markup and the same rules as the post sections in page.tsx.

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

export default async function SocialExtraQueue({ meId }: { meId: string }) {
  const { replies, pending, accounts } = await loadSocialMoreQueue(meId);

  const errors: Record<string, string> = { other: t("admin.err.other") };
  for (const [code, key] of Object.entries(ERROR_KEYS)) errors[code] = t(key);
  errors.notfound = t("admin.social.err.notfoundMore"); // a reply or an account, not a post
  const text: SocialItemModerationText = {
    rule: t("admin.social.rule"),
    reason: t("admin.social.reason", { min: "{min}" }),
    hide: t("admin.social.hide"),
    dismiss: t("admin.social.dismiss"),
    restore: t("admin.review.restore"),
    remove: t("admin.review.remove"),
    handled: t("admin.social.account.handled"),
    sure: {
      hide: t("admin.social.sure.hideReply"),
      dismiss: t("admin.social.sure.dismissMore"),
      restore: t("admin.review.sure.restore"),
      remove: t("admin.social.sure.removeReply"),
      handled: t("admin.social.sure.handled"),
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
      <section>
        <h2 className="pc-title">{t("admin.social.replies.title")}</h2>
        {replies.length === 0 ? (
          <p className="card ad-empty">{t("admin.social.replies.empty")}</p>
        ) : (
          replies.map((item) => (
            <section key={item.id} className="card ad-item">
              <div className="ad-profileTop">
                <div>
                  <h3 className="pc-title">{t("admin.social.reply.label")} #{item.id}</h3>
                  <p className="pc-meta">{t("admin.review.by", { name: item.author })}</p>
                  <p className="pc-meta">{t("admin.social.reply.under", { id: item.postId })}</p>
                </div>
                <div className="ad-badges">
                  <span className="pc-badge pc-badge-info">{t("admin.social.reportCount", { count: item.reports.length })}</span>
                </div>
              </div>
              <div className="ad-quote">
                <p>{item.text}</p>
              </div>
              <ul>
                {item.reports.map((r, index) => (
                  <li key={index} className="pc-meta">
                    {t("admin.social.reportLine", { name: r.reporter, rule: ruleLabel(r.siteRule), reason: r.reason })} · {timeText(r.createdAt)}
                  </li>
                ))}
              </ul>
              <div className="ad-actionRow">
                <Link href={`/social/${item.postId}#replies`} className="btn btn-ghost btn-sm" target="_blank" rel="noopener">
                  {t("admin.review.view")}
                </Link>
              </div>
              {item.own ? (
                <div className="notice notice-info">{t("admin.review.block.self")}</div>
              ) : (
                <SocialItemModerationBox kind="reply" mode="hide" id={String(item.id)} rules={rules} limits={limits} text={text} />
              )}
            </section>
          ))
        )}
      </section>

      <section>
        <h2 className="pc-title">{t("admin.social.replyPending.title")}</h2>
        {pending.length === 0 ? (
          <p className="card ad-empty">{t("admin.social.replyPending.empty")}</p>
        ) : (
          pending.map((item) => (
            <section key={item.id} className="card ad-item">
              <div className="ad-profileTop">
                <div>
                  <h3 className="pc-title">{t("admin.social.reply.label")} #{item.id}</h3>
                  <p className="pc-meta">{t("admin.review.by", { name: item.author })}</p>
                  <p className="pc-meta">{t("admin.social.reply.under", { id: item.postId })}</p>
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
              {item.siteRule && <p className="pc-meta">{t("admin.review.rule", { rule: ruleLabel(item.siteRule) })}</p>}
              {item.reason && <p className="ad-historyReason">{item.reason}</p>}
              {item.block ? (
                <div className="notice notice-info">{t(item.block === "self" ? "admin.review.block.self" : "admin.review.block.same")}</div>
              ) : (
                <SocialItemModerationBox kind="reply" mode="decide" id={String(item.id)} rules={rules} limits={limits} text={text} />
              )}
            </section>
          ))
        )}
      </section>

      <section>
        <h2 className="pc-title">{t("admin.social.accounts.title")}</h2>
        <p className="pc-text">{t("admin.social.accounts.intro")}</p>
        {accounts.length === 0 ? (
          <p className="card ad-empty">{t("admin.social.accounts.empty")}</p>
        ) : (
          accounts.map((item) => (
            <section key={item.id} className="card ad-item">
              <div className="ad-profileTop">
                <div>
                  <h3 className="pc-title">@{item.username}</h3>
                </div>
                <div className="ad-badges">
                  <span className="pc-badge pc-badge-info">{t("admin.social.reportCount", { count: item.reports.length })}</span>
                </div>
              </div>
              <ul>
                {item.reports.map((r, index) => (
                  <li key={index} className="pc-meta">
                    {t("admin.social.reportLine", { name: r.reporter, rule: ruleLabel(r.siteRule), reason: r.reason })} · {timeText(r.createdAt)}
                  </li>
                ))}
              </ul>
              <div className="ad-actionRow">
                <Link href={`/social/u/${item.username}`} className="btn btn-ghost btn-sm" target="_blank" rel="noopener">
                  {t("admin.social.account.view")}
                </Link>
                <Link href={`/admin/people/${item.username}`} className="btn btn-ghost btn-sm">
                  {t("admin.social.account.tools")}
                </Link>
              </div>
              {item.own ? (
                <div className="notice notice-info">{t("admin.review.block.self")}</div>
              ) : (
                <SocialItemModerationBox kind="account" mode="close" id={item.id} rules={rules} limits={limits} text={text} />
              )}
            </section>
          ))
        )}
      </section>
    </>
  );
}
