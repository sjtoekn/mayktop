import Link from "next/link";
import { t } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { staffConfig } from "@/config/site";
import { requireAdmin } from "@/lib/admin";
import { loadReviewQueue } from "@/lib/admin-review";
import ReviewDecision, { type ReviewDecisionText } from "@/components/admin/ReviewDecision";

// Review error code -> text. "self" and "same" reuse the two block texts shown under an item.
const ERROR_KEYS: Record<string, MessageKey> = {
  actor: "admin.err.actor",
  notfound: "admin.review.err.notfound",
  allowed: "admin.review.err.allowed",
  self: "admin.review.block.self",
  rule: "admin.review.err.rule",
  reason: "admin.err.reason",
  state: "admin.review.err.state",
  same: "admin.review.block.same",
};

const MISSING_KEYS: Record<string, MessageKey> = {
  rule: "admin.review.missing.rule",
  reason: "admin.review.missing.reason",
  "audit row": "admin.review.missing.audit",
};

function timeText(date: Date): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date) + " UTC";
}

export default async function AdminReviewPage() {
  const me = await requireAdmin();
  const { items, incomplete } = await loadReviewQueue(me.id);

  const errors: Record<string, string> = { other: t("admin.err.other") };
  for (const [code, key] of Object.entries(ERROR_KEYS)) errors[code] = t(key);
  const text: ReviewDecisionText = {
    note: t("admin.review.note", { min: "{min}" }),
    restore: t("admin.review.restore"),
    remove: t("admin.review.remove"),
    sureRestore: t("admin.review.sure.restore"),
    sureRemove: t("admin.review.sure.remove"),
    back: t("admin.act.back"),
    working: t("admin.act.working"),
    done: t("admin.act.done"),
    errors,
  };
  const kindLabel = (kind: "post" | "comment") => t(kind === "post" ? "modlog.target.post" : "modlog.target.comment");

  return (
    <>
      <section className="ad-head">
        <h1 className="pc-title pc-title-lg">{t("admin.review.title")}</h1>
        <p className="pc-text">{t("admin.review.intro")}</p>
      </section>

      {incomplete.length > 0 && (
        <div className="notice notice-warning ad-incomplete" role="status">
          <p>{t("admin.review.incomplete", { count: incomplete.length })}</p>
          <ul>
            {incomplete.slice(0, 10).map((row) => (
              <li key={`${row.kind}-${row.id}`}>
                {kindLabel(row.kind)} #{row.id}: {row.missing.map((m) => t(MISSING_KEYS[m] ?? "admin.review.missing.rule")).join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length === 0 ? (
        <p className="card ad-empty">{t("admin.review.empty")}</p>
      ) : (
        items.map((item) => (
          <section key={`${item.kind}-${item.id}`} className="card ad-item">
            <div className="ad-profileTop">
              <div>
                <h2 className="pc-title">
                  {kindLabel(item.kind)} #{item.id}
                </h2>
                <p className="pc-meta">
                  {t("admin.review.community", { community: item.community })} · {t("admin.review.by", { name: item.author })}
                </p>
                <p className="pc-meta">
                  {item.hiddenBy && item.hiddenAt
                    ? t("admin.review.hiddenBy", { name: item.hiddenBy, date: timeText(item.hiddenAt) })
                    : item.hiddenAt
                      ? t("admin.review.hiddenOn", { date: timeText(item.hiddenAt) })
                      : ""}
                </p>
              </div>
              <div className="ad-badges">
                <span className="pc-badge pc-badge-info">{kindLabel(item.kind)}</span>
                {item.overdue && <span className="pc-badge pc-badge-danger">{t("admin.review.overdue")}</span>}
              </div>
            </div>

            {item.erased ? (
              <p className="pc-meta">{t("admin.review.erased")}</p>
            ) : (
              <div className="ad-quote">
                {item.title && <p className="ad-itemTitle">{item.title}</p>}
                {item.text && <p>{item.text}</p>}
              </div>
            )}

            {item.rule && <p className="pc-meta">{t("admin.review.rule", { rule: item.rule })}</p>}
            {item.reason && <p className="ad-historyReason">{item.reason}</p>}

            <div className="ad-actionRow">
              <Link href={`/post/${item.postId}`} className="btn btn-ghost btn-sm" target="_blank" rel="noopener">
                {t("admin.review.view")}
              </Link>
            </div>

            {item.block ? (
              <div className="notice notice-info">{t(item.block === "self" ? "admin.review.block.self" : "admin.review.block.same")}</div>
            ) : (
              <ReviewDecision
                kind={item.kind}
                id={item.id}
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
