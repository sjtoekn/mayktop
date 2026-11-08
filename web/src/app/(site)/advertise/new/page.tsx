import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import AdvertiseForm, { type AdvertiseText } from "@/components/AdvertiseForm";
import { adsConfig } from "@/config/site";
import { getLocale, t } from "@/i18n";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getCommunities } from "@/lib/queries";
import "../advertise.css";

export const metadata: Metadata = { title: t("advertise.new.title") };

function price(): string {
  return new Intl.NumberFormat(getLocale(), { style: "currency", currency: adsConfig.currency }).format(adsConfig.monthlyPriceCents / 100);
}

// "2026-11-07" for today (UTC) plus `offset` days. A plain helper outside the component (the clock is read per request,
// after the login cookie was read, because the page is rendered per request inside <Suspense>).
function dayText(offset: number): string {
  return new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function mb(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

function text(): AdvertiseText {
  const limits = {
    titleMin: adsConfig.titleMinLength,
    titleMax: adsConfig.titleMaxLength,
    bodyMin: adsConfig.bodyMinLength,
    bodyMax: adsConfig.bodyMaxLength,
    days: adsConfig.submit.maxStartDaysAhead,
    max: adsConfig.submit.maxWaiting,
  };
  return {
    title: t("advertise.new.title"),
    intro: t("advertise.new.intro"),
    format: t("advertise.new.format"),
    formatNames: {
      TEXT: t("advertise.new.format.TEXT"),
      IMAGE: t("advertise.new.format.IMAGE"),
      VIDEO: t("advertise.new.format.VIDEO"),
    },
    formatSoon: t("advertise.new.format.soon"),
    slot: t("advertise.new.slot"),
    slotNames: { HEADER: t("advertise.new.slot.HEADER"), SIDEBAR: t("advertise.new.slot.SIDEBAR"), FEED: t("advertise.new.slot.FEED"), SOCIAL_FEED: t("advertise.new.slot.SOCIAL_FEED") },
    slotHeaderNote: t("advertise.new.slot.HEADER.note"),
    slotSocialNote: t("advertise.new.slot.SOCIAL_FEED.note"),
    where: t("advertise.new.where"),
    whereAny: t("advertise.new.where.any"),
    fieldTitle: t("advertise.new.field.title"),
    fieldBody: t("advertise.new.field.body"),
    fieldUrl: t("advertise.new.field.url"),
    fieldUrlHint: t("advertise.new.field.url.hint"),
    fieldEmail: t("advertise.new.field.email"),
    fieldEmailHint: t("advertise.new.field.email.hint"),
    fieldStart: t("advertise.new.field.start"),
    fieldStartHint: t("advertise.new.field.start.hint", { days: adsConfig.periodDays }),
    fieldImage: t("advertise.new.field.image"),
    fieldImageHint: t("advertise.new.field.image.hint", { mb: mb(adsConfig.media.imageUploadMaxBytes) }),
    fieldVideo: t("advertise.new.field.video"),
    fieldVideoHint: t("advertise.new.field.video.hint", { mb: mb(adsConfig.media.videoMaxBytes) }),
    previewNoFile: t("advertise.new.preview.nofile"),
    previewTitle: t("advertise.new.preview"),
    previewBadge: t("ad.badge"),
    previewLabel: t("ad.label"),
    priceLine: t("advertise.new.price", { price: price(), days: adsConfig.periodDays }),
    agree: t("advertise.new.agree"),
    rulesLink: t("advertise.new.rules.link"),
    submit: t("advertise.new.submit"),
    saving: t("advertise.new.saving"),
    cancel: t("advertise.new.cancel"),
    login: t("auth.required"),
    loginLink: t("topbar.login"),
    sentTitle: t("advertise.new.sent.title"),
    sentBody: t("advertise.new.sent.body"),
    sentAnother: t("advertise.new.sent.another"),
    sentHome: t("advertise.new.sent.home"),
    errors: {
      other: t("advertise.new.err.other"),
      type: t("advertise.new.err.other"),
      format: t("advertise.new.err.format"),
      slot: t("advertise.new.err.slot"),
      community: t("advertise.new.err.community"),
      title: t("advertise.new.err.title", { min: limits.titleMin, max: limits.titleMax }),
      body: t("advertise.new.err.body", { min: limits.bodyMin, max: limits.bodyMax }),
      textlink: t("advertise.new.err.textlink"),
      words: t("advertise.new.err.words", { phrase: "{phrase}" }),
      url: t("advertise.new.err.url"),
      email: t("advertise.new.err.email"),
      start: t("advertise.new.err.start", { days: limits.days }),
      agree: t("advertise.new.err.agree"),
      "media-missing": t("advertise.new.err.media.missing"),
      "media-size": t("advertise.new.err.media.size", { image: mb(adsConfig.media.imageUploadMaxBytes), video: mb(adsConfig.media.videoMaxBytes) }),
      "media-type": t("advertise.new.err.media.type"),
      "limit-waiting": t("advertise.new.err.limit.waiting", { max: limits.max }),
      "limit-day": t("advertise.new.err.limit.day", { max: adsConfig.submit.maxPerDay }),
    },
  };
}

// It reads the login cookie, so it runs per request (inside <Suspense>), like /settings.
async function Content() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <section className="card adv-card">
        <h1 className="adv-h1">{t("advertise.new.title")}</h1>
        <div className="notice notice-info" role="status">
          {t("auth.required")}{" "}
          <Link href="/login" className="underline">
            {t("topbar.login")}
          </Link>
        </div>
      </section>
    );
  }
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true } });
  // The date picker allows today (UTC) up to adsConfig.submit.maxStartDaysAhead days ahead (dayText, below).
  const communities = (await getCommunities()).map((c) => ({ slug: c.slug, name: c.name }));
  return (
    <AdvertiseForm
      communities={communities}
      initialEmail={account?.email ?? ""}
      limits={{
        titleMax: adsConfig.titleMaxLength,
        bodyMax: adsConfig.bodyMaxLength,
        dateMin: dayText(0),
        dateMax: dayText(adsConfig.submit.maxStartDaysAhead),
        imageMaxBytes: adsConfig.media.imageUploadMaxBytes, // the server makes big pictures smaller
        videoMaxBytes: adsConfig.media.videoMaxBytes,
      }}
      openFormats={[...adsConfig.formatsOpen]}
      text={text()}
    />
  );
}

export default function NewAdPage() {
  return (
    <Suspense fallback={<section className="card adv-card" aria-busy="true" />}>
      <Content />
    </Suspense>
  );
}
