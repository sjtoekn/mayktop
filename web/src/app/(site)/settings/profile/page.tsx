import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ProfileSettingsForm from "@/components/ProfileSettingsForm";
import { auth } from "@/lib/auth";
import { loadAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { profileConfig } from "@/config/site";
import { t } from "@/i18n";
import { UserStatus } from "../../../../../generated/prisma/client";
import "../settings.css";
import "../profile-settings.css";

export const metadata: Metadata = { title: t("settings.profile.title") };

// "Your profile" (patch-profile-security): display name and bio. Reads the login cookie, so it runs per request (inside <Suspense>).
// Not logged in -> /login. A suspended or deletion-pending account cannot edit (the page says so).
async function Content() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const account = await loadAccount(session.user.id);
  if (!account) redirect("/login");

  const person = await prisma.user.findUnique({
    where: { id: account.id },
    select: { displayName: true, bio: true },
  });

  return (
    <div className="sf-wrap">
      <section className="card sf-card">
        <h1 className="sf-h1">{t("settings.profile.title")}</h1>
        <p className="sf-intro">{t("settings.profile.intro", { username: account.username })}</p>
        {account.status === UserStatus.ACTIVE ? (
          <ProfileSettingsForm
            initialName={person?.displayName ?? ""}
            initialBio={person?.bio ?? ""}
            nameMax={profileConfig.displayNameMax}
            bioMax={profileConfig.bioMax}
            text={{
              nameLabel: t("settings.profile.name.label"),
              nameHelp: t("settings.profile.name.help", { max: profileConfig.displayNameMax }),
              bioLabel: t("settings.profile.bio.label"),
              bioHelp: t("settings.profile.bio.help", { max: profileConfig.bioMax }),
              save: t("settings.profile.save"),
              saving: t("settings.profile.saving"),
              saved: t("settings.profile.saved"),
              errors: {
                login: t("settings.profile.error.login"),
                tooMany: t("settings.profile.error.toomany"),
                nameLong: t("settings.profile.error.name.long", { max: profileConfig.displayNameMax }),
                nameReserved: t("settings.profile.error.name.reserved"),
                bioLong: t("settings.profile.error.bio.long", { max: profileConfig.bioMax }),
                generic: t("auth.error.generic"),
              },
            }}
          />
        ) : (
          <p className="sf-intro">{t("settings.inactive")}</p>
        )}
        <p className="pc-meta">{t("settings.profile.note")}</p>
        <div>
          <Link href="/settings" className="pc-btn pc-btn-ghost pc-btn-sm">{t("settings.back")}</Link>
        </div>
      </section>
    </div>
  );
}

export default function ProfileSettingsPage() {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <Content />
    </Suspense>
  );
}
