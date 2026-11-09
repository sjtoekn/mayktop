import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ChangeEmailForm from "@/components/ChangeEmailForm";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { auth } from "@/lib/auth";
import { loadAccount } from "@/lib/account";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/profile-rules";
import { t } from "@/i18n";
import { UserStatus } from "../../../../../generated/prisma/client";
import "../settings.css";
import "../profile-settings.css";

export const metadata: Metadata = { title: t("settings.security.title") };

// "Password and email" (patch-profile-security). Reads the login cookie, so it runs per request (inside <Suspense>).
// Not logged in -> /login. A suspended or deletion-pending account cannot change these (the page says so).
async function Content() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const account = await loadAccount(session.user.id);
  if (!account) redirect("/login");
  const active = account.status === UserStatus.ACTIVE;

  return (
    <div className="sf-wrap">
      <section className="card sf-card">
        <h1 className="sf-h1">{t("settings.security.title")}</h1>
        <p className="sf-intro">{t("settings.security.intro")}</p>
        {!active && <p className="sf-intro">{t("settings.inactive")}</p>}
      </section>

      {active && (
        <>
          <section className="card sf-card ps-section">
            <h2 className="sf-h2">{t("settings.security.password.title")}</h2>
            <p className="sf-intro">{t("settings.security.password.desc")}</p>
            <ChangePasswordForm
              minLength={PASSWORD_MIN}
              maxLength={PASSWORD_MAX}
              text={{
                current: t("settings.security.password.current"),
                next: t("settings.security.password.new"),
                confirm: t("settings.security.password.confirm"),
                submit: t("settings.security.password.submit"),
                working: t("auth.working"),
                done: t("settings.security.password.done"),
                mismatch: t("settings.security.password.error.mismatch"),
                errors: {
                  login: t("settings.profile.error.login"),
                  tooMany: t("settings.security.error.toomany"),
                  wrong: t("settings.security.error.wrong"),
                  short: t("settings.security.password.error.short", { min: PASSWORD_MIN }),
                  long: t("settings.security.password.error.long", { max: PASSWORD_MAX }),
                  same: t("settings.security.password.error.same"),
                  generic: t("auth.error.generic"),
                },
              }}
            />
          </section>

          <section className="card sf-card ps-section">
            <h2 className="sf-h2">{t("settings.security.email.title")}</h2>
            <p className="sf-intro">{t("settings.security.email.desc", { email: account.email })}</p>
            <ChangeEmailForm
              maxLength={254}
              text={{
                newEmail: t("settings.security.email.new"),
                password: t("settings.security.email.password"),
                submit: t("settings.security.email.submit"),
                working: t("auth.working"),
                sent: t("settings.security.email.sent"),
                errors: {
                  login: t("settings.profile.error.login"),
                  tooMany: t("settings.security.error.toomany"),
                  wrong: t("settings.security.error.wrong"),
                  invalid: t("settings.security.email.error.invalid"),
                  same: t("settings.security.email.error.same"),
                  generic: t("auth.error.generic"),
                },
              }}
            />
          </section>
        </>
      )}

      <section className="card sf-card">
        <div>
          <Link href="/settings" className="pc-btn pc-btn-ghost pc-btn-sm">{t("settings.back")}</Link>
        </div>
      </section>
    </div>
  );
}

export default function SecuritySettingsPage() {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <Content />
    </Suspense>
  );
}
