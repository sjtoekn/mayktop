import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AppealForm, { type AppealText } from "@/components/AppealForm";
import DeleteAccountForm, { type DeleteText } from "@/components/DeleteAccountForm";
import { auth } from "@/lib/auth";
import { daysLeft, loadAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { accountConfig, staffConfig, type SiteRuleKey } from "@/config/site";
import { getLocale, t } from "@/i18n";
import "./settings.css";

export const metadata: Metadata = { title: t("settings.title") };

// The settings hub. It reads the login cookie, so it runs per request (inside <Suspense>).
// Not logged in -> /login. Works for a suspended person too (that is how they see why, and
// the export / appeal buttons will appear here in the next patches).
// "Delete your account" (36c): the form for an active account, "Keep my account" while a deletion
// is scheduled, and a short note for a suspended / banned account (they cannot delete yet).
async function Content() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const account = await loadAccount(session.user.id);
  if (!account) redirect("/login");

  const format = new Intl.DateTimeFormat(getLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const when = (d: Date) => `${format.format(d)} UTC`;

  let statusText: string[] = [t("settings.status.active")];
  let warn = false;
  if (account.status === "SUSPENDED" && account.suspensionKind === "BAN") {
    warn = true;
    statusText = [
      account.eraseAt
        ? t("settings.status.banned", { time: when(account.eraseAt) })
        : t("settings.status.banned.open"),
    ];
  } else if (account.status === "SUSPENDED") {
    warn = true;
    statusText = [
      account.suspendedUntil
        ? t("settings.status.suspended", { time: when(account.suspendedUntil) })
        : t("settings.status.suspended.open"),
    ];
  } else if (account.status === "DELETION_PENDING") {
    warn = true;
    statusText = [
      account.eraseAt
        ? t("settings.status.deletion", { time: when(account.eraseAt) })
        : t("settings.status.deletion.open"),
    ];
  }

  // A staff decision (suspension or ban, TODO 36d): show the rule, the reason, the days left, and the appeal.
  const limited = account.status === "SUSPENDED";
  let decisionId: number | null = null;
  if (limited) {
    const decision = await prisma.auditLog.findFirst({
      where: {
        targetType: "USER",
        targetId: account.id,
        action: { in: ["USER_SUSPENDED", "USER_BANNED"] },
      },
      orderBy: { id: "desc" },
      select: { id: true, siteRule: true },
    });
    decisionId = decision?.id ?? null;
    if (decision?.siteRule && staffConfig.siteRules.some((r) => r.key === decision.siteRule)) {
      statusText.push(t("settings.status.rule", { rule: t(`siteRule.${decision.siteRule as SiteRuleKey}`) }));
    }
  }
  if (warn && account.suspensionNote) {
    statusText.push(t("settings.status.reason", { reason: account.suspensionNote }));
  }
  const endsAt = account.status === "SUSPENDED" ? (account.suspensionKind === "BAN" ? account.eraseAt : account.suspendedUntil) : null;
  if (endsAt) {
    statusText.push(t("settings.status.left", { days: daysLeft(endsAt) }));
  }
  const appeal = decisionId
    ? await prisma.appeal.findUnique({
        where: { appellantId_auditLogId: { appellantId: account.id, auditLogId: decisionId } },
        select: { status: true, decisionNote: true },
      })
    : null;
  const appealText: AppealText = {
    message: t("settings.appeal.message"),
    submit: t("settings.appeal.submit"),
    working: t("auth.working"),
    sent: t("settings.appeal.sent"),
    errorShort: t("settings.appeal.error.short", { min: staffConfig.minAppealLength }),
    errorGeneric: t("auth.error.generic"),
  };

  const deleteText: DeleteText = {
    start: t("settings.delete.start"),
    password: t("settings.delete.password"),
    submit: t("settings.delete.submit"),
    back: t("settings.delete.back"),
    done: t("settings.delete.done"),
    keep: t("settings.delete.cancel"),
    working: t("auth.working"),
    errors: {
      password: t("settings.delete.error.password"),
      tooMany: t("settings.delete.error.toomany", { minutes: accountConfig.deletePasswordWindowMinutes }),
      moderator: t("settings.delete.error.moderator"),
      state: t("settings.delete.error.state"),
      generic: t("auth.error.generic"),
    },
    keepError: t("auth.error.generic"),
  };

  return (
    <div className="sf-wrap">
      <section className="card sf-card">
        <h1 className="sf-h1">{t("settings.title")}</h1>
        <p className="sf-intro">{t("settings.intro")}</p>
      </section>

      <section className="card sf-card">
        <h2 className="sf-h2">{t("settings.account")}</h2>
        <ul className="st-facts">
          <li>{t("settings.account.username", { name: account.username })}</li>
          <li>{t("settings.account.email", { email: account.email })}</li>
        </ul>
        <div className={warn ? "st-status st-status-warn" : "st-status"} role={warn ? "alert" : undefined}>
          {statusText.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </section>

      <section className="card sf-card">
        <h2 className="sf-h2">{t("settings.export")}</h2>
        <p className="sf-intro">{t("settings.export.desc")}</p>
        <div>
          <a href="/settings/export" download className="pc-btn pc-btn-sm">
            {t("settings.export.button")}
          </a>
        </div>
      </section>

      <section className="card sf-card">
        <ul className="st-list">
          <li>
            <Link href="/settings/sessions" className="st-link">
              <b>{t("settings.devices")}</b>
              <span>{t("settings.devices.desc")}</span>
            </Link>
          </li>
          <li>
            <Link href="/settings/notifications" className="st-link">
              <b>{t("settings.notif.link")}</b>
              <span>{t("settings.notif.link.desc")}</span>
            </Link>
          </li>
        </ul>
      </section>

      {limited && decisionId && (
        <section className="card sf-card">
          <h2 className="sf-h2">{t("settings.appeal")}</h2>
          {!appeal && (
            <>
              <p className="sf-intro">{t("settings.appeal.desc")}</p>
              <AppealForm text={appealText} />
            </>
          )}
          {appeal?.status === "OPEN" && <p className="sf-intro">{t("settings.appeal.open")}</p>}
          {appeal?.status === "REJECTED" && (
            <p className="sf-intro">{t("settings.appeal.rejected", { note: appeal.decisionNote ?? "" })}</p>
          )}
        </section>
      )}

      <section className="card sf-card">
        <h2 className="sf-h2">{t("settings.delete")}</h2>
        {account.status === "ACTIVE" && (
          <>
            <p className="sf-intro">{t("settings.delete.desc", { days: accountConfig.deletionGraceDays })}</p>
            <DeleteAccountForm mode="request" text={deleteText} />
          </>
        )}
        {account.status === "DELETION_PENDING" && (
          <>
            <p className="sf-intro">{t("settings.delete.pending.desc")}</p>
            <DeleteAccountForm mode="pending" text={deleteText} />
          </>
        )}
        {account.status === "SUSPENDED" && <p className="sf-intro">{t("settings.delete.blocked")}</p>}
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <Content />
    </Suspense>
  );
}
