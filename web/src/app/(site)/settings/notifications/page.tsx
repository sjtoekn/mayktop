import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import NotificationSettingsForm, { type NotificationSettingOption } from "@/components/NotificationSettingsForm";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { t } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { enabledTypesFrom, NOTIFICATION_SETTING_TYPES } from "@/lib/notification-settings-rules";
import "../settings.css";
import "./notifications.css";

export const metadata: Metadata = { title: t("settings.notif.title") };

// "Notification settings" (SOCIAL_TODO B8): which kinds of notification you see. Reads the login cookie, so it runs per request
// (inside <Suspense>). Not logged in -> /login. Everything is ON until you switch it off.
const LABELS: Record<(typeof NOTIFICATION_SETTING_TYPES)[number], MessageKey> = {
  FOLLOW: "settings.notif.type.follow",
  SOCIAL_POST_LIKE: "settings.notif.type.like",
  SOCIAL_POST_REPOST: "settings.notif.type.repost",
  SOCIAL_POST_REPLY: "settings.notif.type.reply",
  SOCIAL_MENTION: "settings.notif.type.mention",
};

async function Content() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const off = await prisma.notificationOptOut.findMany({ where: { userId: session.user.id }, select: { type: true } });
  const enabled = new Set<string>(enabledTypesFrom(off.map((row) => row.type)));
  const options: NotificationSettingOption[] = NOTIFICATION_SETTING_TYPES.map((type) => ({
    type,
    label: t(LABELS[type]),
    enabled: enabled.has(type),
  }));

  return (
    <div className="sf-wrap">
      <section className="card sf-card">
        <h1 className="sf-h1">{t("settings.notif.title")}</h1>
        <p className="sf-intro">{t("settings.notif.intro")}</p>
        <NotificationSettingsForm
          options={options}
          text={{
            save: t("settings.notif.save"),
            saving: t("settings.notif.saving"),
            saved: t("settings.notif.saved"),
            login: t("settings.notif.login"),
            tooMany: t("settings.notif.toomany"),
            error: t("settings.notif.error"),
          }}
        />
        <p className="pc-meta">{t("settings.notif.note")}</p>
        <div>
          <Link href="/settings" className="pc-btn pc-btn-ghost pc-btn-sm">{t("settings.notif.back")}</Link>
        </div>
      </section>
    </div>
  );
}

export default function NotificationSettingsPage() {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <Content />
    </Suspense>
  );
}
