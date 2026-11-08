import Link from "next/link";
import { t } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { requireSuperAdmin } from "@/lib/admin";
import { listAdmins } from "@/lib/admin-people";
import AddAdminForm, { type AddAdminText } from "@/components/admin/AddAdminForm";

const ERROR_CODES = ["actor", "notfound", "target", "self", "superonly"] as const;
const ERROR_KEYS: Record<(typeof ERROR_CODES)[number], MessageKey> = {
  actor: "admin.err.actor",
  notfound: "admin.err.notfound",
  target: "admin.err.target",
  self: "admin.err.self",
  superonly: "admin.err.superonly",
};

// The admin team: ONLY the super admin sees this page (everyone else gets a 404).
export default async function AdminTeamPage() {
  await requireSuperAdmin();
  const admins = await listAdmins();

  const errors: Record<string, string> = { other: t("admin.err.other") };
  for (const code of ERROR_CODES) errors[code] = t(ERROR_KEYS[code]);
  const text: AddAdminText = {
    label: t("admin.team.add.label"),
    button: t("admin.team.add.button"),
    working: t("admin.act.working"),
    done: t("admin.team.add.done"),
    errors,
  };

  return (
    <>
      <h1 className="pc-title pc-title-lg">{t("admin.team.title")}</h1>
      <p className="pc-meta">{t("admin.team.intro")}</p>

      <section className="card ad-actions" aria-labelledby="ad-team-add">
        <h2 id="ad-team-add" className="pc-title">{t("admin.team.add.title")}</h2>
        <AddAdminForm text={text} />
      </section>

      <section className="card ad-history" aria-labelledby="ad-team-list">
        <h2 id="ad-team-list" className="pc-title">{t("admin.team.list")}</h2>
        <ol className="ad-historyList">
          {admins.map((a) => (
            <li key={a.username} className="ad-historyRow">
              <div className="ad-historyTop">
                <b>{a.displayName || a.username} <span className="pc-meta">@{a.username}</span></b>
                <span className={`pc-badge ${a.isSuperAdmin ? "pc-badge-info" : "pc-badge-neutral"}`}>
                  {a.isSuperAdmin ? t("admin.people.role.SUPER") : t("admin.people.role.ADMIN")}
                </span>
              </div>
              {!a.isSuperAdmin && (
                <p>
                  <Link href={`/admin/people/${encodeURIComponent(a.username)}`} className="btn btn-ghost btn-sm">
                    {t("admin.team.manage")}
                  </Link>
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
