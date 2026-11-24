import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import CreatorProgramForm, { type CreatorFormText } from "@/components/CreatorProgramForm";
import { auth } from "@/lib/auth";
import { accountConfig, creatorsConfig } from "@/config/site";
import { getLocale, t } from "@/i18n";
import { getCreatorSettings } from "@/lib/creator-profile";
import { countryOptions, isKnownCountry } from "@/lib/creator-profile-rules";
import { formatUsd, isPayoutCountry } from "@/lib/creator-rules";
import "../settings.css";
import "./creator.css";

export const metadata: Metadata = { title: t("creator.title") };

// Creator earnings: join the program and set where to pay (TODO 12, S6). Reads the login cookie, so it runs per request
// (inside <Suspense>). Not logged in -> /login. Everyone sees the note about payout countries BEFORE joining.
async function Content() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const locale = getLocale();
  const settings = await getCreatorSettings(session.user.id);
  const countries = countryOptions(locale);
  const nameOf = (code: string | null) => (code && isKnownCountry(code) ? (countries.find((c) => c.code === code)?.name ?? code) : "");
  const date = (d: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(d);
  const methodName = (m: string | null) => (m === "PAYPAL" ? t("creator.form.method.PAYPAL") : m === "BANK_LK" ? t("creator.form.method.BANK_LK") : "");

  const text: CreatorFormText = {
    terms: t("creator.form.terms"),
    country: t("creator.form.country"),
    chooseCountry: t("creator.form.country.choose"),
    method: t("creator.form.method"),
    methods: { PAYPAL: t("creator.form.method.PAYPAL"), BANK_LK: t("creator.form.method.BANK_LK") },
    paypalEmail: t("creator.form.paypal"),
    bankName: t("creator.form.bank.name"),
    branch: t("creator.form.bank.branch"),
    holderName: t("creator.form.bank.holder"),
    accountNumber: t("creator.form.bank.account"),
    keepHint: t("creator.form.keep"),
    password: t("creator.form.password"),
    submitJoin: t("creator.form.submit.join"),
    submitSave: t("creator.form.submit.save"),
    working: t("auth.working"),
    joined: t("creator.form.joined"),
    saved: t("creator.form.saved"),
    notOpen: t("creator.note.other"),
    noMethodNeeded: t("creator.form.nomethod"),
    errors: {
      login: t("creator.error.login"),
      tooMany: t("creator.error.toomany"),
      terms: t("creator.error.terms"),
      country: t("creator.error.country"),
      method: t("creator.error.method"),
      paypal: t("creator.error.paypal"),
      bank: t("creator.error.bank"),
      noKey: t("creator.error.nokey"),
      exists: t("creator.error.exists"),
      notJoined: t("creator.error.notjoined"),
      password: t("creator.error.password"),
      passwordTries: t("creator.error.passwordtries", { minutes: accountConfig.deletePasswordWindowMinutes }),
      generic: t("auth.error.generic"),
    },
  };
  const methodsByCountry: Record<string, string[]> = {};
  for (const [code, list] of Object.entries(creatorsConfig.payoutMethods)) methodsByCountry[code] = [...list];

  return (
    <div className="sf-wrap">
      <section className="card sf-card">
        <h1 className="sf-h1">{t("creator.title")}</h1>
        <p className="sf-intro">{t("creator.intro")}</p>
        <ul className="cr-points">
          <li>{t("creator.point.1", { percent: creatorsConfig.sharePercent })}</li>
          <li>{t("creator.point.2")}</li>
          <li>{t("creator.point.3", { days: creatorsConfig.holdDays, min: formatUsd(creatorsConfig.minPayoutMicroUsd) })}</li>
          <li>{t("creator.point.4")}</li>
        </ul>
        <p className="notice cr-note" role="note">{t("creator.note.countries")}</p>
      </section>

      {!settings && (
        <section className="card sf-card">
          <h2 className="sf-h2">{t("creator.join.title")}</h2>
          <CreatorProgramForm
            mode="join"
            text={text}
            countries={countries}
            methodsByCountry={methodsByCountry}
            initial={{ country: "", method: "" }}
            hasSavedDetails={false}
          />
        </section>
      )}

      {settings && (
        <>
          <section className="card sf-card">
            <h2 className="sf-h2">{t("creator.status.title")}</h2>
            <ul className="cr-facts">
              <li>{t("creator.facts.joined", { date: date(settings.joinedAt) })}</li>
              <li>{t("creator.facts.terms", { version: settings.termsVersion })}</li>
              <li>{t("creator.facts.country", { country: nameOf(settings.country) || "—" })}</li>
              {settings.method && <li>{t("creator.facts.method", { method: methodName(settings.method) })}</li>}
              {settings.method && (
                <li>{settings.masked ? t("creator.facts.details", { details: settings.masked }) : settings.hasDetails ? t("creator.facts.details.hidden") : t("creator.facts.nodetails")}</li>
              )}
            </ul>
            {!isPayoutCountry(settings.country) && <p className="notice cr-note" role="note">{t("creator.note.other")}</p>}
            {settings.holdUntil && <p className="pc-meta">{t("creator.facts.hold", { date: date(settings.holdUntil) })}</p>}
            {settings.frozen && <p className="notice notice-danger cr-note" role="alert">{t("creator.facts.frozen")}</p>}
          </section>

          <section className="card sf-card">
            <h2 className="sf-h2">{t("creator.edit.title")}</h2>
            <p className="sf-intro">{t("creator.edit.desc", { days: creatorsConfig.detailsChangeHoldDays })}</p>
            <CreatorProgramForm
              mode="edit"
              text={text}
              countries={countries}
              methodsByCountry={methodsByCountry}
              initial={{ country: settings.country ?? "", method: settings.method ?? "" }}
              hasSavedDetails={settings.hasDetails}
            />
          </section>
        </>
      )}

      <section className="card sf-card">
        <div className="cr-actions">
          {settings && <Link href="/creator" className="pc-btn pc-btn-sm">{t("creator.dashboard.link")}</Link>}
          <Link href="/settings" className="pc-btn pc-btn-ghost pc-btn-sm">{t("creator.back")}</Link>
        </div>
      </section>
    </div>
  );
}

export default function CreatorSettingsPage() {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <Content />
    </Suspense>
  );
}
