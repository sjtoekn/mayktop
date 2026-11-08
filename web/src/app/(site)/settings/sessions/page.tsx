import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import SessionsList, { type SessionItem } from "@/components/SessionsList";
import { auth } from "@/lib/auth";
import { describeDevice } from "@/lib/devices";
import { prisma } from "@/lib/prisma";
import { getLocale, t } from "@/i18n";
import "./sessions.css";

export const metadata: Metadata = { title: t("sessions.title") };

// "Your devices": every place the person is logged in, with a button to log the others out.
// It reads the login cookie, so it runs per request (inside <Suspense>). Not logged in -> /login.
// Times are shown in UTC (clearly labelled) so the server and the browser always agree.
async function Content() {
  const current = await auth.api.getSession({ headers: await headers() });
  if (!current) redirect("/login");

  const rows = await prisma.session.findMany({
    where: { userId: current.user.id, expiresAt: { gt: new Date() } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, ipAddress: true, userAgent: true, createdAt: true, updatedAt: true },
  });

  const format = new Intl.DateTimeFormat(getLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const when = (d: Date) => `${format.format(d)} UTC`;

  const items: SessionItem[] = rows.map((r) => ({
    id: r.id,
    name: describeDevice(r.userAgent) ?? t("sessions.unknown"),
    ip: r.ipAddress,
    started: t("sessions.started", { time: when(r.createdAt) }),
    active: t("sessions.active", { time: when(r.updatedAt) }),
    current: r.id === current.session.id,
  }));
  const ipLabels: Record<string, string> = {};
  for (const r of rows) if (r.ipAddress) ipLabels[r.id] = t("sessions.ip", { ip: r.ipAddress });

  return (
    <div className="sf-wrap">
      <section className="card sf-card">
        <h1 className="sf-h1">{t("sessions.title")}</h1>
        <p className="sf-intro">{t("sessions.intro")}</p>
        <SessionsList
          items={items}
          ipLabels={ipLabels}
          text={{
            current: t("sessions.current"),
            logout: t("sessions.logout"),
            logoutOthers: t("sessions.logout.others"),
            only: t("sessions.only"),
            working: t("auth.working"),
            error: t("sessions.error"),
          }}
        />
      </section>
    </div>
  );
}

export default function SessionsPage() {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <Content />
    </Suspense>
  );
}
