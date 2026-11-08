import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdAppealForm, { type AdAppealText } from "@/components/AdAppealForm";
import AdMedia from "@/components/AdMedia";
import { appealConfig, staffConfig } from "@/config/site";
import { getLocale, t } from "@/i18n";
import { getSessionUser } from "@/lib/session";
import { getAdAppealView } from "@/lib/appeals";
import "../../../advertise.css";
import "../../my.css";
import "../../../../settings/settings.css";

export const metadata: Metadata = { title: t("advertise.my.appeal.title") };

// Appeal the rejection of an ad (ADS_PLAN Session 4c). Only the advertiser of the ad can open this page; for any other ad or
// person it is a plain "not found" (we never say whether somebody else's ad exists). It reads the login cookie, so it runs
// per request (inside <Suspense>), like the edit page.
function text(): AdAppealText {
  return {
    message: t("advertise.my.appeal.message"),
    submit: t("settings.appeal.submit"),
    working: t("auth.working"),
    sent: t("advertise.my.appeal.sent"),
    errorShort: t("settings.appeal.error.short", { min: staffConfig.minAppealLength }),
    errorWindow: t("advertise.my.appeal.err.window", { days: appealConfig.windowDays }),
    errorExists: t("advertise.my.appeal.err.exists"),
    errorState: t("advertise.my.err.state"),
    errorGeneric: t("auth.error.generic"),
    errorLogin: t("auth.required"),
  };
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return (
      <section className="card adv-card">
        <h1 className="adv-h1">{t("advertise.my.appeal.title")}</h1>
        <div className="notice notice-info" role="status">
          {t("auth.required")}{" "}
          <Link href="/login" className="underline">
            {t("topbar.login")}
          </Link>
        </div>
      </section>
    );
  }
  const { id } = await params;
  const adId = /^\d{1,9}$/.test(id) ? Number(id) : NaN;
  if (!Number.isInteger(adId)) notFound();
  const view = await getAdAppealView(user.id, adId);
  if (!view) notFound();
  const { ad, info } = view;
  const { appeal, state, refused } = info;
  const format = new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeZone: "UTC" });

  return (
    <div className="adv-wrap">
      <section className="card adv-card">
        <h1 className="adv-h1">{t("advertise.my.appeal.title")}</h1>
        <aside className="card card-ad my-preview" aria-label={t("ad.label")}>
          <span className="badge badge-ad">{t("ad.badge")}</span>
          <AdMedia format={ad.format} imageUrl={ad.imageUrl} videoUrl={ad.videoUrl} title={ad.title} />
          <p className="my-previewTitle">{ad.title}</p>
          <p className="pc-text">{ad.body}</p>
        </aside>
        {(ad.rule || ad.reason) && (
          <div className="notice notice-warning my-why" role="status">
            {ad.rule && <p className="pc-text">{t("advertise.my.rejected", { rule: ad.rule })}</p>}
            {ad.reason && <p className="pc-text">{t("advertise.my.reason", { reason: ad.reason })}</p>}
          </div>
        )}
      </section>

      <section className="card adv-card">
        {state === "can" && (
          <>
            <p className="adv-text">{t("advertise.my.appeal.desc", { days: appealConfig.windowDays })}</p>
            <AdAppealForm adId={ad.id} text={text()} />
          </>
        )}
        {state === "open" && appeal && (
          <p className="adv-text">{t("advertise.my.appeal.open", { date: format.format(appeal.createdAt) })}</p>
        )}
        {state === "accepted" && appeal && <p className="adv-text">{t("advertise.my.appeal.accepted", { note: appeal.note })}</p>}
        {state === "rejected" && appeal && <p className="adv-text">{t("advertise.my.appeal.rejected", { note: appeal.note })}</p>}
        {state === "none" && (
          <p className="adv-text">
            {refused === "window"
              ? t("advertise.my.appeal.err.window", { days: appealConfig.windowDays })
              : t("advertise.my.appeal.blocked")}
          </p>
        )}
        <div className="adv-actions">
          <Link href="/advertise/my" className="btn btn-ghost btn-sm">
            {t("advertise.my.appeal.back")}
          </Link>
        </div>
      </section>
    </div>
  );
}

// Only the empty page shell is prepared at build time; no ad is read for this placeholder id.
export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function AdAppealPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<section className="card adv-card" aria-busy="true" />}>
      <Content params={params} />
    </Suspense>
  );
}
