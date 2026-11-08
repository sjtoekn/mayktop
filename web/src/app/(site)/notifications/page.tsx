import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import Icon from "@/components/shell/Icon";
import { t } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { getSessionUser } from "@/lib/session";
import { loadNotifications } from "@/lib/social-notifications";
import { markAllNotificationsRead } from "./actions";
import "./notifications.css";

export const metadata: Metadata = {
  title: t("notifications.title"),
  robots: { index: false, follow: false },
};

const TEXT_KEYS: Record<string, MessageKey> = {
  FOLLOW: "notifications.type.follow",
  SOCIAL_POST_LIKE: "notifications.type.like",
  SOCIAL_POST_REPOST: "notifications.type.repost",
  SOCIAL_POST_REPLY: "notifications.type.reply",
  SOCIAL_MENTION: "notifications.type.mention",
};

// The notifications of the logged-in person (SOCIAL_TODO 21): newest first, unread ones marked. ONLY for logged-in
// people: a visitor sees the log-in message and nothing is read. The list belongs to one person, so it is not cached.
export default async function NotificationsPage() {
  await connection();

  const viewer = await getSessionUser();

  if (!viewer) {
    return (
      <>
        <header className="card pg-head">
          <h1 className="sf-h1">{t("notifications.title")}</h1>
        </header>
        <section className="card pg-empty">
          <span className="pc-avatar pc-a4" aria-hidden="true"><Icon name="shield" size={26} /></span>
          <p>{t("notifications.loginRequired")}</p>
          <div className="fa-actions">
            <Link href="/login" className="pc-btn">{t("topbar.login")}</Link>
            <Link href="/signup" className="pc-btn pc-btn-ghost">{t("topbar.signup")}</Link>
          </div>
        </section>
      </>
    );
  }

  const items = await loadNotifications(viewer.id);
  const hasUnread = items.some((item) => item.unread);

  return (
    <>
      <header className="card pg-head nt-bar">
        <h1 className="sf-h1">{t("notifications.title")}</h1>
        {hasUnread && (
          <form action={markAllNotificationsRead}>
            <button type="submit" className="pc-pill">{t("notifications.markAll")}</button>
          </form>
        )}
      </header>

      {items.length === 0 ? (
        <section className="card pg-empty">
          <span className="pc-avatar pc-a4" aria-hidden="true"><Icon name="bell" size={26} /></span>
          <p>{t("notifications.empty")}</p>
        </section>
      ) : (
        <ul className="nt-list">
          {items.map((item) => {
            const tone = ((item.actor.charCodeAt(0) || 0) % 5) + 1;
            return (
              <li key={item.id}>
                <Link href={item.href} className={`card nt-item${item.unread ? " is-unread" : ""}`}>
                  <span className={`pc-avatar pc-a${tone}`} aria-hidden="true">{item.actor.charAt(0).toUpperCase()}</span>
                  <span className="nt-text">{t(TEXT_KEYS[item.type] ?? "notifications.type.follow", { name: item.actorName })}</span>
                  {item.unread && <span className="nt-new">{t("notifications.new")}</span>}
                  <span className="nt-time">{item.time}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
