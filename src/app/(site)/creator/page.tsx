import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { creatorsConfig } from "@/config/site";
import { formatNumber, getLocale, t } from "@/i18n";
import { getCreatorOverview, OVERVIEW_DAYS } from "@/lib/creator-overview";
import { barHeights, type PageRole } from "@/lib/creator-overview-rules";
import { formatUsd } from "@/lib/creator-rules";
import "@/components/ad-detail.css";
import "./creator-overview.css";

export const metadata: Metadata = { title: t("creator.ov.title") };

// Creator Overview (TODO 12, S5): what the person's question / answer pages earn. Read-only. Reads the login cookie, so it
// runs per request (inside <Suspense>). Not logged in -> /login. Not joined -> a short invitation (no empty numbers).
const usd = (micro: number) => `USD ${formatUsd(micro)}`;

async function Content() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const locale = getLocale();
  const day = (ms: number) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(ms));
  const date = (d: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(d);
  const ov = await getCreatorOverview(session.user.id);

  if (!ov) {
    return (
      <div className="cro-wrap">
        <section className="card cro-empty">
          <h1 className="pc-title">{t("creator.ov.title")}</h1>
          <p className="pc-text">{t("creator.ov.notjoined")}</p>
          <p className="notice" role="note">{t("creator.note.countries")}</p>
          <Link href="/creator-program" className="fa-link">{t("creatorProgram.link")}</Link>
          <Link href="/settings/creator" className="pc-btn pc-btn-sm">{t("creator.ov.join")}</Link>
        </section>
      </div>
    );
  }

  const roleText: Record<PageRole, string> = {
    ASKER: t("creator.ov.role.asker"),
    ANSWER: t("creator.ov.role.answer"),
    BOTH: t("creator.ov.role.both"),
  };
  const statusText: Record<string, string> = {
    PENDING: t("creator.ov.status.pending"),
    PAID: t("creator.ov.status.paid"),
    FAILED: t("creator.ov.status.failed"),
  };
  const methodText: Record<string, string> = { PAYPAL: t("creator.form.method.PAYPAL"), BANK_LK: t("creator.form.method.BANK_LK") };
  const countryName = ov.settings.country
    ? (new Intl.DisplayNames([locale, "en"], { type: "region" }).of(ov.settings.country) ?? ov.settings.country)
    : "—";

  const n = ov.next;
  const nextText =
    n.kind === "none-country" ? t("creator.ov.next.country")
    : n.kind === "frozen" ? t("creator.ov.next.frozen")
    : n.kind === "no-details" ? t("creator.ov.next.nodetails")
    : n.kind === "details-wait" ? t("creator.ov.next.wait", { date: date(new Date(n.untilMs)) })
    : n.kind === "need-more" ? t("creator.ov.next.more", { amount: usd(n.missingMicro), min: usd(creatorsConfig.minPayoutMicroUsd) })
    : t("creator.ov.next.ready");

  const bars = barHeights(ov.days.map((d) => d.impressions));
  const b = ov.balances;
  const noData = ov.impressions30 === 0 && ov.pages.length === 0 && b.totalOpenMicro === 0 && b.paidMicro === 0 && ov.estimateMicro === 0;

  return (
    <div className="cro-wrap">
      <div className="cro-top">
        <h1 className="pc-title">{t("creator.ov.title")}</h1>
        <div className="cro-links">
          <Link href="/settings/creator" className="btn btn-ghost btn-sm">{t("creator.ov.settings")}</Link>
        </div>
      </div>
      <p className="pc-text">{t("creator.ov.intro")}</p>
      <Link href="/creator-program" className="fa-link">{t("creatorProgram.link")}</Link>

      {!ov.isPayoutCountry && <p className="notice" role="note">{t("creator.note.other")}</p>}

      {noData && (
        <section className="card cro-empty">
          <p className="pc-text">{t("creator.ov.nodata")}</p>
        </section>
      )}

      <dl className="adt-cards cro-cards">
        <div className="card adt-card">
          <dt>{t("creator.ov.card.month")}</dt>
          <dd>{formatNumber(ov.impressionsMonth)}</dd>
          <span className="adt-sub">{t("creator.ov.card.month.sub")}</span>
        </div>
        <div className="card adt-card cro-estimate">
          <dt>{t("creator.ov.card.estimate")}</dt>
          <dd>{usd(ov.estimateMicro)}</dd>
          <span className="adt-sub">{t("creator.ov.card.estimate.sub", { n: ov.estimateAds })}</span>
        </div>
        <div className="card adt-card">
          <dt>{t("creator.ov.card.accrued")}</dt>
          <dd>{usd(Math.max(0, b.accruedMicro))}</dd>
          <span className="adt-sub">{t("creator.ov.card.accrued.sub", { days: creatorsConfig.holdDays })}</span>
        </div>
        <div className="card adt-card">
          <dt>{t("creator.ov.card.payable")}</dt>
          <dd>{usd(Math.max(0, b.payableMicro))}</dd>
          <span className="adt-sub">{t("creator.ov.card.payable.sub", { min: usd(creatorsConfig.minPayoutMicroUsd) })}</span>
        </div>
        <div className="card adt-card">
          <dt>{t("creator.ov.card.held")}</dt>
          <dd>{usd(Math.max(0, b.heldMicro))}</dd>
          <span className="adt-sub">{t("creator.ov.card.held.sub")}</span>
        </div>
        {b.inPayoutMicro > 0 && (
          <div className="card adt-card">
            <dt>{t("creator.ov.card.inpayout")}</dt>
            <dd>{usd(b.inPayoutMicro)}</dd>
          </div>
        )}
        <div className="card adt-card">
          <dt>{t("creator.ov.card.paid")}</dt>
          <dd>{usd(Math.max(0, b.paidMicro))}</dd>
        </div>
      </dl>
      <p className="adt-note">{t("creator.ov.estimate.note")}</p>

      <section className="card adt-block" aria-label={t("creator.ov.chart.title", { days: OVERVIEW_DAYS })}>
        <h2 className="pc-title">{t("creator.ov.chart.title", { days: OVERVIEW_DAYS })}</h2>
        {ov.impressions30 === 0 ? (
          <p className="pc-meta">{t("creator.ov.chart.none")}</p>
        ) : (
          <div className="adt-chartWrap">
            <div className="adt-chart" role="img" aria-label={t("creator.ov.chart.aria", { total: formatNumber(ov.impressions30), days: OVERVIEW_DAYS })}>
              {ov.days.map((d, i) => (
                <div key={d.dayMs} className="adt-col" title={`${day(d.dayMs)}: ${formatNumber(d.impressions)}`}>
                  <div className="adt-bar" style={{ height: `${bars[i]}%` }} />
                </div>
              ))}
            </div>
            <div className="adt-axis"><span>{day(ov.days[0].dayMs)}</span><span>{day(ov.days[ov.days.length - 1].dayMs)}</span></div>
          </div>
        )}
      </section>

      <section className="card adt-block" aria-label={t("creator.ov.table.title")}>
        <h2 className="pc-title">{t("creator.ov.table.title")}</h2>
        {ov.pages.length === 0 ? (
          <p className="pc-meta">{t("creator.ov.table.none")}</p>
        ) : (
          <div className="adt-tableWrap">
            <table className="adt-table">
              <thead>
                <tr>
                  <th scope="col">{t("creator.ov.table.page")}</th>
                  <th scope="col">{t("creator.ov.table.role")}</th>
                  <th scope="col">{t("creator.ov.table.impressions", { days: OVERVIEW_DAYS })}</th>
                  <th scope="col">{t("creator.ov.table.earned")}</th>
                </tr>
              </thead>
              <tbody>
                {ov.pages.map((p) => (
                  <tr key={p.postId}>
                    <th scope="row" className="adt-left"><Link href={`/post/${p.postId}`} className="cro-title">{p.title}</Link></th>
                    <td className="adt-left">{roleText[p.role]}</td>
                    <td>{formatNumber(p.impressions)}</td>
                    <td>{usd(p.earnedMicro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ov.pagesTotal > ov.pages.length && <p className="adt-note">{t("creator.ov.table.more", { n: ov.pagesTotal - ov.pages.length })}</p>}
      </section>

      <section className="card adt-block" aria-label={t("creator.ov.payout.title")}>
        <h2 className="pc-title">{t("creator.ov.payout.title")}</h2>
        <ul className="cro-facts">
          <li>{t("creator.facts.country", { country: countryName })}</li>
          {ov.settings.method && <li>{t("creator.facts.method", { method: methodText[ov.settings.method] ?? ov.settings.method })}</li>}
          {ov.settings.masked && <li>{t("creator.facts.details", { details: ov.settings.masked })}</li>}
        </ul>
        <p className="cro-next">{nextText}</p>
        <h3 className="pc-title">{t("creator.ov.history.title")}</h3>
        {ov.payouts.length === 0 ? (
          <p className="pc-meta">{t("creator.ov.history.none")}</p>
        ) : (
          <div className="adt-tableWrap">
            <table className="adt-table">
              <thead>
                <tr>
                  <th scope="col">{t("creator.ov.history.date")}</th>
                  <th scope="col">{t("creator.ov.history.amount")}</th>
                  <th scope="col">{t("creator.ov.history.status")}</th>
                </tr>
              </thead>
              <tbody>
                {ov.payouts.map((p) => (
                  <tr key={p.id}>
                    <th scope="row" className="adt-left">{date(p.paidAt ?? p.createdAt)}</th>
                    <td>{usd(p.amountMicro)}</td>
                    <td>{statusText[p.status] ?? p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="adt-note">{t("creator.ov.privacy")}</p>
    </div>
  );
}

export default function CreatorOverviewPage() {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <Content />
    </Suspense>
  );
}
