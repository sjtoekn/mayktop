import Link from "next/link";
import { formatNumber, t } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { creatorsConfig } from "@/config/site";
import { requireAdmin } from "@/lib/admin";
import { formatUsd } from "@/lib/creator-rules";
import { parseCountryFilter, type Blocker } from "@/lib/creator-payout-rules";
import { loadPayoutsPage, type PayoutLine } from "@/lib/creator-payouts";
import PayoutAction, { type PayoutActionText } from "@/components/admin/PayoutAction";
import "./payouts.css";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ERROR_CODES = ["empty", "conflict", "state", "notfound", "reference", "duplicate", "reason", "frozen", "notallowed", "nokey", "country", "type"] as const;
const BLOCKED_KEYS: Record<Blocker, MessageKey> = {
  account: "admin.payouts.blocked.account",
  frozen: "admin.payouts.blocked.frozen",
  "no-method": "admin.payouts.blocked.noMethod",
  "no-details": "admin.payouts.blocked.noDetails",
  "details-wait": "admin.payouts.blocked.detailsWait",
  minimum: "admin.payouts.blocked.minimum",
};

function dateText(date: Date | null): string {
  return date ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date) : "-";
}

export default async function AdminPayoutsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const country = parseCountryFilter(sp.country);
  const data = await loadPayoutsPage(country);

  const errors: Record<string, string> = { other: t("admin.err.other") };
  for (const code of ERROR_CODES) errors[code] = t(`admin.payouts.err.${code}` as MessageKey);
  const common = {
    continue: t("admin.act.continue"),
    cancel: t("admin.act.cancel"),
    back: t("admin.act.back"),
    working: t("admin.act.working"),
    done: t("admin.act.done"),
    errors,
  };
  const text = (button: MessageKey, sure: string, field?: MessageKey): PayoutActionText => ({
    button: t(button),
    sure,
    field: field ? t(field) : undefined,
    ...common,
  });

  const csvLinks = (batchId: number, payouts: PayoutLine[]) => {
    const methods = [...new Set(payouts.filter((p) => p.status === "PENDING").map((p) => p.method))];
    return methods.map((m) => (
      data.keyReady ? (
        <a key={m} className="btn btn-secondary btn-sm" href={`/admin/payouts/export?batch=${batchId}&method=${m}`}>
          {t(`admin.payouts.csv.${m}` as MessageKey)}
        </a>
      ) : null
    ));
  };

  return (
    <>
      <section className="ad-head">
        <h1 className="pc-title pc-title-lg">{t("admin.payouts.title")}</h1>
        <p className="pc-text">{t("admin.payouts.intro", { min: formatUsd(creatorsConfig.minPayoutMicroUsd), days: creatorsConfig.holdDays })}</p>
      </section>

      {/* 1. Ready to pay */}
      <section className="card pay-section" aria-labelledby="pay-ready">
        <div className="pay-sum">
          <h2 className="pc-title" id="pay-ready">{t("admin.payouts.ready.title")}</h2>
          <nav className="pay-filter" aria-label={t("admin.payouts.filter.label")}>
            <Link href="/admin/payouts" className={`btn btn-sm ${country ? "btn-ghost" : "btn-secondary"}`}>{t("admin.payouts.filter.all")}</Link>
            {creatorsConfig.payoutCountries.map((c) => (
              <Link key={c} href={`/admin/payouts?country=${c}`} className={`btn btn-sm ${country === c ? "btn-secondary" : "btn-ghost"}`}>{c}</Link>
            ))}
          </nav>
        </div>
        {data.ready.length === 0 ? (
          <p className="pc-meta">{t("admin.payouts.ready.empty")}</p>
        ) : (
          <>
            <p className="pc-text">{t("admin.payouts.ready.total", { count: formatNumber(data.ready.length), amount: formatUsd(data.readyMicro) })}</p>
            {data.ready.map((r) => (
              <div key={r.userId} className="pay-row">
                <div className="pay-who">
                  <strong><Link href={`/admin/people/${encodeURIComponent(r.username)}`}>@{r.username}</Link></strong>
                  <p className="pc-meta">{r.country} · {t(`admin.payouts.method.${r.method}` as MessageKey)}</p>
                </div>
                <span className="pay-amount">USD {formatUsd(r.amountMicro)}</span>
                <div className="pay-act">
                  <PayoutAction kind="hold" userId={r.userId} danger text={text("admin.payouts.btn.hold", t("admin.payouts.sure.hold", { name: `@${r.username}` }), "admin.payouts.field.reason")} />
                </div>
              </div>
            ))}
            <div className="pay-act">
              <PayoutAction
                kind="batch"
                country={country}
                text={text("admin.payouts.btn.batch", t("admin.payouts.sure.batch", { count: formatNumber(data.ready.length), amount: formatUsd(data.readyMicro) }))}
              />
            </div>
          </>
        )}
      </section>

      {/* 2. Open rounds: download, pay outside, write the reference */}
      <section className="card pay-section" aria-labelledby="pay-open">
        <h2 className="pc-title" id="pay-open">{t("admin.payouts.batches.title")}</h2>
        <p className="pc-meta">{t("admin.payouts.csv.note")}</p>
        {!data.keyReady && <div className="notice notice-danger" role="alert">{t("admin.payouts.csv.nokey")}</div>}
        {data.batches.length === 0 && <p className="pc-meta">{t("admin.payouts.batches.empty")}</p>}
        {data.batches.map((b) => (
          <div key={b.id} className="pay-section">
            <div className="pay-sum">
              <h3 className="pc-title">{t("admin.payouts.batch.item", { id: b.id, date: dateText(b.createdAt) })}</h3>
              <div className="pay-csv">{csvLinks(b.id, b.payouts)}</div>
            </div>
            {b.payouts.map((p) => (
              <div key={p.id} className="pay-row">
                <div className="pay-who">
                  <strong>@{p.username}</strong>
                  <p className="pc-meta">FALV-{p.id} · {p.country} · {t(`admin.payouts.method.${p.method}` as MessageKey)}</p>
                </div>
                <span className="pay-amount">USD {formatUsd(p.amountMicro)}</span>
                <div className="pay-act">
                  {p.status === "PENDING" ? (
                    <div className="ad-actionRow">
                      <PayoutAction kind="paid" payoutId={p.id} text={text("admin.payouts.btn.paid", t("admin.payouts.sure.paid"), "admin.payouts.field.reference")} maxLength={80} />
                      <PayoutAction kind="failed" payoutId={p.id} danger text={text("admin.payouts.btn.failed", t("admin.payouts.sure.failed"), "admin.payouts.field.reason")} />
                    </div>
                  ) : (
                    <span className={`pc-badge ${p.status === "PAID" ? "pc-badge-info" : "pc-badge-danger"}`}>{t(`admin.payouts.status.${p.status}` as MessageKey)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* 3. People with money who are not in the round */}
      <section className="card pay-section" aria-labelledby="pay-blocked">
        <h2 className="pc-title" id="pay-blocked">{t("admin.payouts.blocked.title")}</h2>
        <p className="pc-meta">{t("admin.payouts.blocked.intro")}</p>
        {data.blocked.length === 0 && <p className="pc-meta">{t("admin.payouts.blocked.empty")}</p>}
        {data.blocked.map((b) => (
          <div key={`${b.userId}-${b.reason}`} className="pay-row">
            <div className="pay-who">
              <strong><Link href={`/admin/people/${encodeURIComponent(b.username)}`}>@{b.username}</Link></strong>
              <p className="pc-meta">{b.country ?? "-"} · {t(BLOCKED_KEYS[b.reason])}</p>
            </div>
            <span className="pay-amount">USD {formatUsd(b.payableMicro)}</span>
            <div className="pay-act">
              {b.reason === "account" && (
                <PayoutAction kind="reverse" userId={b.userId} danger text={text("admin.payouts.btn.reverse", t("admin.payouts.sure.reverse", { name: `@${b.username}`, amount: formatUsd(b.payableMicro) }), "admin.payouts.field.reason")} />
              )}
            </div>
          </div>
        ))}
      </section>

      {/* 4. Frozen earnings */}
      <section className="card pay-section" aria-labelledby="pay-frozen">
        <h2 className="pc-title" id="pay-frozen">{t("admin.payouts.frozen.title")}</h2>
        {data.frozen.length === 0 && <p className="pc-meta">{t("admin.payouts.frozen.empty")}</p>}
        {data.frozen.map((f) => (
          <div key={f.userId} className="pay-row">
            <div className="pay-who">
              <strong><Link href={`/admin/people/${encodeURIComponent(f.username)}`}>@{f.username}</Link></strong>
              {f.note && <p className="pc-meta">{f.note}</p>}
            </div>
            <span className="pay-amount">USD {formatUsd(f.openMicro)}</span>
            <div className="pay-act">
              <div className="ad-actionRow">
                <PayoutAction kind="release" userId={f.userId} text={text("admin.payouts.btn.release", t("admin.payouts.sure.release", { name: `@${f.username}` }), "admin.payouts.field.reason")} />
                <PayoutAction kind="reverse" userId={f.userId} danger text={text("admin.payouts.btn.reverse", t("admin.payouts.sure.reverse", { name: `@${f.username}`, amount: formatUsd(f.openMicro) }), "admin.payouts.field.reason")} />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* 5. History */}
      <section className="card pay-section" aria-labelledby="pay-paid">
        <h2 className="pc-title" id="pay-paid">{t("admin.payouts.paid.title")}</h2>
        {data.recentPaid.length === 0 && <p className="pc-meta">{t("admin.payouts.paid.empty")}</p>}
        {data.recentPaid.map((p) => (
          <div key={p.id} className="pay-row">
            <div className="pay-who">
              <strong>@{p.username}</strong>
              <p className="pc-meta">FALV-{p.id} · {p.country} · {t(`admin.payouts.method.${p.method}` as MessageKey)} · {dateText(p.paidAt)}{p.reference ? ` · ${p.reference}` : ""}</p>
            </div>
            <span className="pay-amount">USD {formatUsd(p.amountMicro)}</span>
          </div>
        ))}
      </section>
    </>
  );
}
