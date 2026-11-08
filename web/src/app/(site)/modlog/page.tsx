import type { Metadata } from "next";
import Link from "next/link";
import { t } from "@/i18n";
import { getModLog, type ModActionKind } from "@/lib/queries";

export const metadata: Metadata = { title: t("modlog.title") };

// Colour of the label for each kind of action (tokens from globals.css only).
const tone: Record<ModActionKind, string> = {
  hidden: "pc-badge-warning",
  restored: "pc-badge-success",
  removed: "pc-badge-danger",
  appealUpheld: "pc-badge-info",
  appealDenied: "pc-badge-neutral",
};

function actionLabel(action: ModActionKind) {
  switch (action) {
    case "hidden": return t("modlog.action.hidden");
    case "restored": return t("modlog.action.restored");
    case "removed": return t("modlog.action.removed");
    case "appealUpheld": return t("modlog.action.appealUpheld");
    case "appealDenied": return t("modlog.action.appealDenied");
  }
}

export default async function ModLogPage() {
  const modLog = await getModLog();
  return (
    <>
      <section className="card pc-modlog-head">
        <h1 className="pc-title pc-title-lg">{t("modlog.title")}</h1>
        <p className="pc-text">{t("modlog.intro")}</p>
      </section>

      {modLog.length === 0 && <p className="card pc-empty">{t("modlog.empty")}</p>}

      <ol className="pc-modlog-list">
        {modLog.map((e) => (
          <li key={e.id} className="card pc-modlog-item">
            <div className="pc-modlog-top">
              <span className={`pc-badge ${tone[e.action]}`}>{actionLabel(e.action)}</span>
              <span className="pc-meta">{e.time}</span>
            </div>
            <div className="pc-modlog-subject">
              {e.target === "post" ? t("modlog.target.post") : t("modlog.target.comment")}
              {" · "}
              <Link href={`/c/${e.community}`}>c/{e.community}</Link>
              {e.subject && <>{" · "}{e.subject}</>}
            </div>
            {e.rule && (
              <p className="pc-modlog-line">
                {t("modlog.rule")} <b>{e.rule}</b>
              </p>
            )}
            {e.reason && (
              <p className="pc-modlog-line">
                {t("modlog.reason")} {e.reason}
              </p>
            )}
            <div className="pc-modlog-foot">
              <span className="pc-meta">{t("modlog.moderator", { name: e.moderator })}</span>
              {e.postId !== undefined && (
                <Link href={`/post/${e.postId}`} className="pc-pill pc-pill-sm">
                  {t("modlog.view")}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
