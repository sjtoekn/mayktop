import Link from "next/link";
import { notFound } from "next/navigation";
import { formatNumber, t } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { staffConfig } from "@/config/site";
import { requireAdmin } from "@/lib/admin";
import { actionsFor, getPerson } from "@/lib/admin-people";
import PersonActions, { type PersonActionsText } from "@/components/admin/PersonActions";

// Names of the audit actions that can concern a person. Anything else is shown as its raw name.
const AUDIT_LABELS: Record<string, MessageKey> = {
  USER_SUSPENDED: "admin.audit.USER_SUSPENDED",
  USER_BANNED: "admin.audit.USER_BANNED",
  BAN_PROPOSED: "admin.audit.BAN_PROPOSED",
  BAN_REJECTED: "admin.audit.BAN_REJECTED",
  USER_RESTORED: "admin.audit.USER_RESTORED",
  USER_EDITED: "admin.audit.USER_EDITED",
  ROLE_CHANGED: "admin.audit.ROLE_CHANGED",
  LEGAL_HOLD_SET: "admin.audit.LEGAL_HOLD_SET",
  LEGAL_HOLD_RELEASED: "admin.audit.LEGAL_HOLD_RELEASED",
  ACCOUNT_ERASE_WARNED: "admin.audit.ACCOUNT_ERASE_WARNED",
  ACCOUNT_ERASED: "admin.audit.ACCOUNT_ERASED",
  SAFETY_RECORD_SWEPT: "admin.audit.SAFETY_RECORD_SWEPT",
};

const ERROR_CODES = ["actor", "notfound", "target", "self", "rule", "reason", "days", "state", "ladder", "pending", "noproposal", "approver", "lastadmin", "superonly", "name", "bio", "username", "usernametaken", "email", "emailtaken", "nochange", "confirm", "hold", "appeal", "nosecret"] as const;
const ERROR_KEYS: Record<(typeof ERROR_CODES)[number], MessageKey> = {
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
  superonly: "admin.err.superonly",
  name: "admin.err.name",
  bio: "admin.err.bio",
  username: "admin.err.username",
  usernametaken: "admin.err.usernametaken",
  email: "admin.err.email",
  emailtaken: "admin.err.emailtaken",
  nochange: "admin.err.nochange",
  confirm: "admin.err.confirm",
  hold: "admin.err.hold",
  appeal: "admin.err.appeal",
  nosecret: "admin.err.nosecret",
};

function timeText(date: Date): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date) + " UTC";
}

function ruleLabel(key: string): string {
  const full = t(`siteRule.${key}` as MessageKey);
  const cut = full.search(/[:：]/);
  return cut > 0 ? full.slice(0, cut) : full;
}

export default async function AdminPersonPage({ params }: { params: Promise<{ username: string }> }) {
  const { username: raw } = await params;
  let username = raw;
  try {
    username = decodeURIComponent(raw);
  } catch {
    // a broken address like /admin/people/%E0%A4: keep it as it is, it will not match anybody (404 below)
  }
  const [me, person] = await Promise.all([requireAdmin(), getPerson(username)]);
  if (!person) notFound();

  const isSelf = person.id === me.id;
  const actions = actionsFor(person, isSelf, me.isSuperAdmin);
  const name = person.displayName || person.username;
  const statusText = person.banned ? t("admin.people.status.BANNED") : t(`admin.people.status.${person.status}`);
  const statusBadge = person.banned
    ? "pc-badge-danger"
    : person.status === "ACTIVE"
      ? "pc-badge-success"
      : person.status === "SUSPENDED"
        ? "pc-badge-warning"
        : "pc-badge-neutral";

  const errors: Record<string, string> = { other: t("admin.err.other") };
  for (const code of ERROR_CODES) errors[code] = t(ERROR_KEYS[code]);
  const text: PersonActionsText = {
    title: t("admin.act.title"),
    buttons: {
      edit: t("admin.act.edit"),
      erase: t("admin.act.erase"),
      suspend: t("admin.act.suspend"),
      lift: t("admin.act.lift"),
      makeAdmin: t("admin.act.makeAdmin"),
      removeAdmin: t("admin.act.removeAdmin"),
      proposeBan: t("admin.act.proposeBan"),
    },
    notes: {
      edit: t("admin.act.note.edit"),
      erase: t("admin.act.note.erase"),
      suspend: t("admin.act.note.suspend"),
      lift: t("admin.act.note.lift"),
      makeAdmin: t("admin.act.note.makeAdmin"),
      removeAdmin: t("admin.act.note.removeAdmin"),
      proposeBan: t("admin.act.note.proposeBan", { days: staffConfig.banProposalDays }),
    },
    sure: {
      edit: t("admin.act.sure.edit", { name: "{name}" }),
      erase: t("admin.act.sure.erase", { name: "{name}" }),
      suspend: t("admin.act.sure.suspend", { name: "{name}", days: "{days}" }),
      lift: t("admin.act.sure.lift", { name: "{name}" }),
      makeAdmin: t("admin.act.sure.makeAdmin", { name: "{name}" }),
      removeAdmin: t("admin.act.sure.removeAdmin", { name: "{name}" }),
      proposeBan: t("admin.act.sure.proposeBan", { name: "{name}" }),
    },
    rule: t("admin.act.rule"),
    days: t("admin.act.days", { max: "{max}" }),
    reason: t("admin.act.reason", { min: "{min}" }),
    fields: {
      displayName: t("admin.act.f.displayName"),
      bio: t("admin.act.f.bio"),
      username: t("admin.act.f.username"),
      email: t("admin.act.f.email"),
      confirm: t("admin.act.f.confirm", { username: "{username}" }),
    },
    erased: t("admin.act.erased"),
    erasedNotes: t("admin.act.erasedNotes"),
    erasedOpen: t("admin.act.erasedOpen"),
    continue: t("admin.act.continue"),
    back: t("admin.act.back"),
    cancel: t("admin.act.cancel"),
    working: t("admin.act.working"),
    done: t("admin.act.done"),
    errors,
  };
  const rules = staffConfig.siteRules.map((r) => ({ key: r.key, label: ruleLabel(r.key) }));

  return (
    <>
      <p>
        <Link href="/admin/people" className="btn btn-ghost btn-sm">← {t("admin.person.back")}</Link>
      </p>

      <section className="card ad-profile">
        <div className="ad-profileTop">
          <div>
            <h1 className="pc-title pc-title-lg">{name}</h1>
            <p className="pc-meta">@{person.username} · {person.email}</p>
            {person.bio && <p className="pc-meta">{person.bio}</p>}
          </div>
          <div className="ad-badges">
            <span className={`pc-badge ${statusBadge}`}>{statusText}</span>
            <span className={`pc-badge ${person.role === "ADMIN" ? "pc-badge-info" : "pc-badge-neutral"}`}>
              {person.isSuperAdmin ? t("admin.people.role.SUPER") : t(`admin.people.role.${person.role}`)}
            </span>
          </div>
        </div>

        <dl className="ad-facts">
          <div><dt>{t("admin.person.joined")}</dt><dd>{timeText(person.createdAt)}</dd></div>
          <div><dt>{t("admin.person.posts")}</dt><dd>{formatNumber(person.posts)}</dd></div>
          <div><dt>{t("admin.person.comments")}</dt><dd>{formatNumber(person.comments)}</dd></div>
        </dl>

        {person.status === "SUSPENDED" && (
          <div className="notice notice-warning">
            {person.suspendedUntil && <p>{t("admin.person.until", { time: timeText(person.suspendedUntil) })}</p>}
            {person.eraseAt && <p>{t("admin.person.erase", { time: timeText(person.eraseAt) })}</p>}
            {person.suspensionNote && <p>{t("admin.person.reason", { reason: person.suspensionNote })}</p>}
          </div>
        )}
        {person.status === "DELETION_PENDING" && person.eraseAt && (
          <div className="notice notice-info">{t("admin.person.erase", { time: timeText(person.eraseAt) })}</div>
        )}
      </section>

      {actions.length > 0 ? (
        <PersonActions
          username={person.username}
          name={name}
          actions={actions}
          rules={rules}
          limits={{
            minReason: staffConfig.minReasonLength,
            maxReason: staffConfig.maxReasonLength,
            maxDays: staffConfig.maxSuspensionDays,
            maxName: staffConfig.maxDisplayNameLength,
            maxBio: staffConfig.maxBioLength,
          }}
          profile={{ displayName: person.displayName ?? "", bio: person.bio ?? "", username: person.username, email: person.email }}
          text={text}
        />
      ) : (
        <section className="card ad-actions">
          <h2 className="pc-title">{t("admin.act.title")}</h2>
          <p className="pc-meta">{isSelf ? t("admin.act.none.self") : t("admin.act.none.state")}</p>
        </section>
      )}

      <section className="card ad-history" aria-labelledby="ad-history-title">
        <h2 id="ad-history-title" className="pc-title">{t("admin.person.history.title")}</h2>
        {person.history.length === 0 ? (
          <p className="pc-meta">{t("admin.person.history.empty")}</p>
        ) : (
          <ol className="ad-historyList">
            {person.history.map((h) => (
              <li key={h.id} className="ad-historyRow">
                <div className="ad-historyTop">
                  <b>{AUDIT_LABELS[h.action] ? t(AUDIT_LABELS[h.action]) : h.action}</b>
                  <span className="pc-meta">{timeText(h.createdAt)} · {h.by === null ? t("admin.person.history.system") : t("admin.person.history.by", { name: h.by })}</span>
                </div>
                {h.siteRule && <p className="pc-meta">{t("settings.status.rule", { rule: ruleLabel(h.siteRule) })}</p>}
                {h.reason && <p className="ad-historyReason">{h.reason}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
