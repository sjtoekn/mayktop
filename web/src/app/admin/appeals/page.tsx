import Link from "next/link";
import { t } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { staffConfig } from "@/config/site";
import { requireAdmin } from "@/lib/admin";
import { loadAppealQueue } from "@/lib/admin-appeals";
import AppealDecision, { type AppealDecisionText } from "@/components/admin/AppealDecision";
import AdMedia from "@/components/AdMedia";

// Appeal error code -> text. "self" and "same" reuse the two block texts shown under an appeal.
const ERROR_KEYS: Record<string, MessageKey> = {
  actor: "admin.err.actor",
  notfound: "admin.appeals.err.notfound",
  allowed: "admin.appeals.err.allowed",
  self: "admin.appeals.block.self",
  same: "admin.appeals.block.same",
  state: "admin.appeals.err.state",
  window: "admin.appeals.err.state",
  exists: "admin.appeals.err.state",
  message: "admin.err.reason",
};

function actionLabel(action: string): string {
  if (action === "CONTENT_REMOVED") return t("admin.appeals.first.removed");
  if (action === "USER_SUSPENDED") return t("admin.audit.USER_SUSPENDED");
  if (action === "USER_BANNED") return t("admin.audit.USER_BANNED");
  if (action === "AD_REJECTED") return t("admin.appeals.first.adRejected");
  return t("admin.appeals.first.other");
}

function timeText(date: Date): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date) + " UTC";
}

export default async function AdminAppealsPage() {
  const me = await requireAdmin();
  const items = await loadAppealQueue(me.id);

  const errors: Record<string, string> = { other: t("admin.err.other") };
  for (const [code, key] of Object.entries(ERROR_KEYS)) errors[code] = t(key);
  const text: AppealDecisionText = {
    note: t("admin.appeals.note", { min: "{min}" }),
    accept: t("admin.appeals.accept"),
    reject: t("admin.appeals.reject"),
    sureAcceptContent: t("admin.appeals.sure.accept.content"),
    sureAcceptAccount: t("admin.appeals.sure.accept.account"),
    sureAcceptAd: t("admin.appeals.sure.accept.ad"),
    sureReject: t("admin.appeals.sure.reject"),
    back: t("admin.act.back"),
    working: t("admin.act.working"),
    done: t("admin.act.done"),
    errors,
  };

  return (
    <>
      <section className="ad-head">
        <h1 className="pc-title pc-title-lg">{t("admin.appeals.title")}</h1>
        <p className="pc-text">{t("admin.appeals.intro")}</p>
      </section>

      {items.length === 0 ? (
        <p className="card ad-empty">{t("admin.appeals.empty")}</p>
      ) : (
        items.map((item) => (
          <section key={item.id} className="card ad-item">
            <div className="ad-profileTop">
              <div>
                <h2 className="pc-title">{t("admin.appeals.item", { id: item.id })}</h2>
                <p className="pc-meta">
                  {t("admin.appeals.from", { name: item.appellant, date: timeText(item.createdAt) })}
                </p>
              </div>
              <div className="ad-badges">
                <span className="pc-badge pc-badge-info">
                  {t(item.kind === "account" ? "admin.appeals.kind.account" : item.kind === "ad" ? "admin.appeals.kind.ad" : "admin.appeals.kind.content")}
                </span>
                {item.overdue && <span className="pc-badge pc-badge-danger">{t("admin.review.overdue")}</span>}
              </div>
            </div>

            <div className="ad-block">
              <p className="ad-label">{t("admin.appeals.message")}</p>
              <p className="ad-quote">{item.message}</p>
            </div>

            <div className="ad-block">
              <p className="ad-label">{t("admin.appeals.first")}</p>
              <p className="pc-meta">{t("admin.appeals.firstBy", { action: actionLabel(item.firstAction), name: item.firstActor })}</p>
              {item.rule && <p className="pc-meta">{t("admin.review.rule", { rule: item.rule })}</p>}
              {item.reason && <p className="ad-historyReason">{item.reason}</p>}
            </div>

            {(item.contentKind || item.social) && (
              <div className="ad-block">
                <p className="ad-label">{t("admin.appeals.content")}</p>
                {item.social && <p className="pc-meta">{t(item.social === "post" ? "admin.appeals.social.post" : "admin.appeals.social.reply")}</p>}
                {item.preview && <p className="ad-quote">{item.preview}</p>}
                {item.community && <p className="pc-meta">{t("admin.review.community", { community: item.community })}</p>}
              </div>
            )}

            {item.ad && (
              <div className="ad-block">
                <p className="ad-label">{t("admin.appeals.ad")}</p>
                <AdMedia format={item.ad.format} imageUrl={item.ad.imageUrl} videoUrl={item.ad.videoUrl} title={item.ad.title} />
                <p className="ad-quote">{item.ad.title}</p>
                <p className="pc-text">{item.ad.body}</p>
              </div>
            )}

            <div className="ad-actionRow">
              {item.postId !== null && (
                <Link href={`/post/${item.postId}`} className="btn btn-ghost btn-sm" target="_blank" rel="noopener">
                  {t("admin.review.view")}
                </Link>
              )}
              {item.kind === "account" && (
                <Link href={`/admin/people/${encodeURIComponent(item.appellant)}`} className="btn btn-ghost btn-sm">
                  {t("admin.appeals.person")}
                </Link>
              )}
            </div>

            {item.block ? (
              <div className="notice notice-info">{t(item.block === "self" ? "admin.appeals.block.self" : "admin.appeals.block.same")}</div>
            ) : (
              <AppealDecision
                appealId={item.id}
                kind={item.kind}
                limits={{ minReason: staffConfig.minReasonLength, maxReason: staffConfig.maxReasonLength }}
                text={text}
              />
            )}
          </section>
        ))
      )}
    </>
  );
}
