import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import SocialAppealForm from "@/components/social/SocialAppealForm";
import type { ContentAppealText } from "@/components/ContentAppealForm";
import { auth } from "@/lib/auth";
import { getSocialAppealView } from "@/lib/social-appeal";
import { parseSocialKind, socialViewPath } from "@/lib/social-appeal-rules";
import { appealConfig, staffConfig } from "@/config/site";
import { getLocale, t } from "@/i18n";
import "../../../../settings/settings.css";

export const metadata: Metadata = { title: t("appeal.title") };

// Appeal a REMOVED Social post / reply (SOCIAL_TODO 29). It reads the login cookie, so it runs per request (inside <Suspense>).
// Not logged in -> /login. Somebody else's item, or one that does not exist -> "not found" (we never say which).
// Placeholder ids: they only let Next.js prepare the page shell in advance, like /appeal/post/<id> does.
export function generateStaticParams() {
  return [
    { kind: "post", id: "1" },
    { kind: "reply", id: "1" },
  ];
}

export default function SocialAppealPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind: rawKind, id } = await params;
  const kind = parseSocialKind(rawKind);
  if (!kind) notFound();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const view = await getSocialAppealView(session.user.id, kind, Number(id));
  if (!view) notFound();

  const format = new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeZone: "UTC" });
  const text: ContentAppealText = {
    message: t("appeal.message"),
    submit: t("settings.appeal.submit"),
    working: t("auth.working"),
    sent: t("settings.appeal.sent"),
    errorShort: t("settings.appeal.error.short", { min: staffConfig.minAppealLength }),
    errorWindow: t("appeal.error.window", { days: appealConfig.windowDays }),
    errorExists: t("appeal.error.exists"),
    errorGeneric: t("auth.error.generic"),
  };
  const { content, appeal, blocked } = view;

  return (
    <div className="sf-wrap">
      <section className="card sf-card">
        <h1 className="sf-h1">{t("appeal.title")}</h1>
        <p className="sf-intro">{t(kind === "post" ? "appeal.social.what.post" : "appeal.social.what.reply", { excerpt: content.excerpt })}</p>
        {content.rule && (
          <p className="sf-intro">
            {t("post.hidden.reason")} <b>{content.rule}</b>
          </p>
        )}
        {content.reason && <p className="sf-intro">{content.reason}</p>}
      </section>

      <section className="card sf-card">
        {appeal === null && blocked === null && (
          <>
            <p className="sf-intro">{t("appeal.desc", { days: appealConfig.windowDays })}</p>
            <SocialAppealForm kind={kind} id={content.id} text={text} />
          </>
        )}
        {appeal === null && blocked === "window" && (
          <p className="sf-intro">{t("appeal.error.window", { days: appealConfig.windowDays })}</p>
        )}
        {appeal === null && blocked !== null && blocked !== "window" && <p className="sf-intro">{t("appeal.blocked")}</p>}
        {appeal?.status === "OPEN" && (
          <p className="sf-intro">{t("appeal.open", { date: format.format(appeal.createdAt) })}</p>
        )}
        {appeal?.status === "ACCEPTED" && (
          <p className="sf-intro">
            {t("appeal.accepted", { note: appeal.note })}{" "}
            <Link href={socialViewPath(content.postId)}>{t("appeal.view")}</Link>
          </p>
        )}
        {appeal?.status === "REJECTED" && <p className="sf-intro">{t("appeal.rejected", { note: appeal.note })}</p>}
      </section>
    </div>
  );
}
