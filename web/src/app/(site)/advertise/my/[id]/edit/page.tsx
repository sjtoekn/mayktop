import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import EditAdForm, { type EditAdText } from "@/components/EditAdForm";
import { adsConfig } from "@/config/site";
import { t } from "@/i18n";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { checkOwnEdit } from "@/lib/ad-own-rules";
import { AD_RULE_TEXT, isPolicyRule } from "@/lib/ad-review-rules";
import "../../../advertise.css";
import "../../my.css";

export const metadata: Metadata = { title: t("advertise.my.edit.title") };

// Fix a rejected ad and send it again (ADS_PLAN Session 4b). Only the advertiser of a REJECTED ad can open this page;
// for any other ad or person it is a plain "not found" (we do not admit the ad exists).
function text(): EditAdText {
  return {
    fieldTitle: t("advertise.new.field.title"),
    fieldBody: t("advertise.new.field.body"),
    fieldUrl: t("advertise.new.field.url"),
    fieldUrlHint: t("advertise.new.field.url.hint"),
    fieldEmail: t("advertise.new.field.email"),
    fieldEmailHint: t("advertise.new.field.email.hint"),
    agree: t("advertise.new.agree"),
    rulesLink: t("advertise.new.rules.link"),
    send: t("advertise.my.edit.send"),
    saving: t("advertise.new.saving"),
    cancel: t("advertise.new.cancel"),
    errors: {
      other: t("advertise.new.err.other"),
      type: t("advertise.new.err.other"),
      format: t("advertise.new.err.other"),
      slot: t("advertise.new.err.other"),
      start: t("advertise.new.err.other"),
      title: t("advertise.new.err.title", { min: adsConfig.titleMinLength, max: adsConfig.titleMaxLength }),
      body: t("advertise.new.err.body", { min: adsConfig.bodyMinLength, max: adsConfig.bodyMaxLength }),
      textlink: t("advertise.new.err.textlink"),
      words: t("advertise.new.err.words", { phrase: "{phrase}" }),
      url: t("advertise.new.err.url"),
      email: t("advertise.new.err.email"),
      agree: t("advertise.new.err.agree"),
      "limit-waiting": t("advertise.new.err.limit.waiting", { max: adsConfig.submit.maxWaiting }),
      notfound: t("advertise.my.err.notfound"),
      state: t("advertise.my.err.state"),
      login: t("auth.required"),
    },
  };
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return (
      <section className="card adv-card">
        <h1 className="adv-h1">{t("advertise.my.edit.title")}</h1>
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
  const ad = await prisma.adCampaign.findUnique({
    where: { id: adId },
    select: { id: true, advertiserId: true, status: true, endDate: true, title: true, body: true, destinationUrl: true, contactEmail: true, reviewRule: true, reviewNote: true },
  });
  if (!ad || checkOwnEdit(ad, user.id) !== null) notFound();
  const rule = ad.reviewRule && isPolicyRule(ad.reviewRule) ? t(AD_RULE_TEXT[ad.reviewRule]) : ad.reviewRule;

  return (
    <div className="adv-wrap">
      <section className="card adv-card">
        <h1 className="adv-h1">{t("advertise.my.edit.title")}</h1>
        <p className="adv-text">{t("advertise.my.edit.intro")}</p>
        <div className="notice notice-warning my-why" role="status">
          {rule && <p className="pc-text">{t("advertise.my.rejected", { rule })}</p>}
          {ad.reviewNote && <p className="pc-text">{t("advertise.my.reason", { reason: ad.reviewNote })}</p>}
        </div>
        <p className="adv-hint">{t("advertise.my.edit.fixed")}</p>
      </section>
      <EditAdForm
        adId={ad.id}
        initial={{ title: ad.title, body: ad.body, url: ad.destinationUrl, email: ad.contactEmail }}
        limits={{ titleMax: adsConfig.titleMaxLength, bodyMax: adsConfig.bodyMaxLength }}
        text={text()}
      />
    </div>
  );
}

// Only the empty page shell is prepared at build time; no ad is read for this placeholder id.
export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function EditAdPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<section className="card adv-card" aria-busy="true" />}>
      <Content params={params} />
    </Suspense>
  );
}
