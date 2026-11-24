import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ProfileSettingsForm from "@/components/ProfileSettingsForm";
import { auth } from "@/lib/auth";
import { loadAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { profileConfig, reputationConfig } from "@/config/site";
import { parseSocialLinks } from "@/lib/profile-rules";
import { t } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
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
    select: { displayName: true, bio: true, profession: true, qualifications: true, website: true, profileVideo: true, socialLinks: true, verifiedAt: true },
  });
  const kinds = Object.keys(profileConfig.socialSites);

  return (
    <div className="sf-wrap">
      <section className="card sf-card">
        <h1 className="sf-h1">{t("settings.profile.title")}</h1>
        <p className="sf-intro">{t("settings.profile.intro", { username: account.username })}</p>
        {account.status === UserStatus.ACTIVE ? (
          <ProfileSettingsForm
            initial={{
              displayName: person?.displayName ?? "",
              bio: person?.bio ?? "",
              profession: person?.profession ?? "",
              qualifications: person?.qualifications ?? "",
              website: person?.website ?? "",
              video: person?.profileVideo ?? "",
              links: Object.fromEntries(parseSocialLinks(person?.socialLinks).map((link) => [link.kind, link.url])),
            }}
            kinds={kinds}
            nameMax={profileConfig.displayNameMax}
            bioMax={profileConfig.bioMax}
            professionMax={profileConfig.professionMax}
            qualificationsMax={profileConfig.qualificationsMax}
            websiteMax={profileConfig.websiteMax}
            verified={person?.verifiedAt != null}
            text={{
              nameLabel: t("settings.profile.name.label"),
              nameHelp: t("settings.profile.name.help", { max: profileConfig.displayNameMax }),
              bioLabel: t("settings.profile.bio.label"),
              bioHelp: t("settings.profile.bio.help", { max: profileConfig.bioMax }),
              professionLabel: t("settings.profile.profession.label"),
              professionHelp: t("settings.profile.profession.help", { max: profileConfig.professionMax }),
              qualificationsLabel: t("settings.profile.qualifications.label"),
              qualificationsHelp: t("settings.profile.qualifications.help", { max: profileConfig.qualificationsMax }),
              websiteLabel: t("settings.profile.website.label"),
              websiteHelp: t("settings.profile.website.help"),
              videoLabel: t("settings.profile.video.label"),
              videoHelp: t("settings.profile.video.help", { need: reputationConfig.privileges.video }),
              linksLabel: t("settings.profile.links.label"),
              linksHelp: t("settings.profile.links.help"),
              siteLabels: Object.fromEntries(kinds.map((kind) => [kind, t(`profile.site.${kind}` as MessageKey)])),
              verifiedNote: t("settings.profile.verified.note"),
              save: t("settings.profile.save"),
              saving: t("settings.profile.saving"),
              saved: t("settings.profile.saved"),
              errors: {
                login: t("settings.profile.error.login"),
                tooMany: t("settings.profile.error.toomany"),
                nameLong: t("settings.profile.error.name.long", { max: profileConfig.displayNameMax }),
                nameReserved: t("settings.profile.error.name.reserved"),
                bioLong: t("settings.profile.error.bio.long", { max: profileConfig.bioMax }),
                professionLong: t("settings.profile.error.profession.long", { max: profileConfig.professionMax }),
                qualificationsLong: t("settings.profile.error.qualifications.long", { max: profileConfig.qualificationsMax }),
                websiteInvalid: t("settings.profile.error.website.invalid"),
                linksInvalid: t("settings.profile.error.links.invalid"),
                videoInvalid: t("settings.profile.error.video.invalid"),
                linksLocked: t("submit.error.link", { need: reputationConfig.privileges.link }),
                videoLocked: t("submit.error.videoaccess", { need: reputationConfig.privileges.video }),
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
