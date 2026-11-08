import Link from "next/link";
import { t } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { staffConfig } from "@/config/site";
import { requireAdmin } from "@/lib/admin";
import { proposalDaysLeft } from "@/lib/admin-people";
import { listBanProposals } from "@/lib/staff";
import BanDecision, { type BanDecisionText } from "@/components/admin/BanDecision";

const ERROR_KEYS: Record<string, MessageKey> = {
  actor: "admin.err.actor",
  notfound: "admin.err.notfound",
  target: "admin.err.target",
  self: "admin.err.self",
  rule: "admin.err.rule",
  reason: "admin.err.reason",
  days: "admin.err.days",
  state: "admin.err.state",
  ladder: "admin.err.ladder",
  pending: "admin.err.pending",
  noproposal: "admin.err.noproposal",
  approver: "admin.err.approver",
  lastadmin: "admin.err.lastadmin",
};

function ruleLabel(key: string): string {
  const full = t(`siteRule.${key}` as MessageKey);
  const cut = full.search(/[:：]/);
  return cut > 0 ? full.slice(0, cut) : full;
}

function timeText(date: Date): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date) + " UTC";
}

export default async function AdminBansPage() {
  const me = await requireAdmin();
  const proposals = await listBanProposals();

  const errors: Record<string, string> = { other: t("admin.err.other") };
  for (const [code, key] of Object.entries(ERROR_KEYS)) errors[code] = t(key);
  const text: BanDecisionText = {
    note: t("admin.bans.note", { min: "{min}" }),
    approve: t("admin.bans.approve"),
    reject: t("admin.bans.reject"),
    sureApprove: t("admin.bans.sure.approve", { name: "{name}", days: "{days}" }),
    sureReject: t("admin.bans.sure.reject", { name: "{name}" }),
    back: t("admin.act.back"),
    working: t("admin.act.working"),
    done: t("admin.act.done"),
    errors,
  };

  return (
    <>
      <section className="ad-head">
        <h1 className="pc-title pc-title-lg">{t("admin.bans.title")}</h1>
        <p className="pc-text">{t("admin.bans.intro")}</p>
      </section>

      {proposals.length === 0 ? (
        <p className="card ad-empty">{t("admin.bans.empty")}</p>
      ) : (
        proposals.map((p) => {
          const own = p.proposedBy === me.username;
          const daysLeft = proposalDaysLeft(p.createdAt);
          return (
            <section key={p.id} className="card ad-proposal">
              <div className="ad-profileTop">
                <div>
                  <h2 className="pc-title">
                    <Link href={`/admin/people/${encodeURIComponent(p.person)}`}>@{p.person}</Link>
                  </h2>
                  <p className="pc-meta">
                    {t("admin.bans.proposedBy", { name: p.proposedBy })} · {timeText(p.createdAt)}
                  </p>
                </div>
                <div className="ad-badges">
                  <span className="pc-badge pc-badge-warning">{t("settings.status.left", { days: daysLeft })}</span>
                </div>
              </div>
              <p className="pc-meta">{t("settings.status.rule", { rule: ruleLabel(p.rule) })}</p>
              <p className="ad-historyReason">{p.reason}</p>
              {own && <div className="notice notice-info">{t("admin.bans.own")}</div>}
              <BanDecision
                proposalId={p.id}
                name={`@${p.person}`}
                own={own}
                limits={{ minReason: staffConfig.minReasonLength, maxReason: staffConfig.maxReasonLength }}
                graceDays={staffConfig.banGraceDays}
                text={text}
              />
            </section>
          );
        })
      )}
    </>
  );
}
