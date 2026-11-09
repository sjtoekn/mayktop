import Link from "next/link";
import { formatNumber, t, tn } from "@/i18n";
import { staffConfig } from "@/config/site";
import { requireAdmin } from "@/lib/admin";
import { loadCommunities } from "@/lib/admin-communities";
import ModeratorBox, { type ModeratorBoxText } from "@/components/admin/ModeratorBox";
import { countPendingRequests } from "@/lib/community-request";
import { crText } from "@/lib/community-request-text";
import "./communities.css";

function dateText(date: Date): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export default async function AdminCommunitiesPage() {
  await requireAdmin();
  const { communities, overLimit, threshold, max } = await loadCommunities();
  const pendingRequests = await countPendingRequests();

  // Moderator error code -> text. "reason" and "actor" reuse the general admin texts.
  const errors: Record<string, string> = {
    other: t("admin.err.other"),
    actor: t("admin.err.actor"),
    reason: t("admin.err.reason", { min: "{min}", max: "{max}" }),
    notfound: t("admin.communities.err.notfound"),
    target: t("admin.communities.err.target"),
    already: t("admin.communities.err.already"),
    limit: t("admin.communities.err.limit", { max: "{maxLarge}", threshold: "{threshold}" }),
    notmod: t("admin.communities.err.notmod"),
    last: t("admin.communities.err.last"),
  };
  const text: ModeratorBoxText = {
    none: t("admin.communities.nomods"),
    add: t("admin.communities.add"),
    remove: t("admin.communities.remove"),
    person: t("admin.communities.person"),
    reason: t("admin.act.reason", { min: "{min}" }),
    noteAdd: t("admin.communities.note.add"),
    noteRemove: t("admin.communities.note.remove"),
    sureAdd: t("admin.communities.sure.add", { name: "{name}", community: "{community}" }),
    sureRemove: t("admin.communities.sure.remove", { name: "{name}", community: "{community}" }),
    continue: t("admin.act.continue"),
    back: t("admin.act.back"),
    cancel: t("admin.act.cancel"),
    working: t("admin.act.working"),
    done: t("admin.act.done"),
    errors,
  };
  const limits = {
    minReason: staffConfig.minReasonLength,
    maxReason: staffConfig.maxReasonLength,
    maxLarge: max,
    threshold,
  };

  return (
    <>
      <section className="ad-head">
        <h1 className="pc-title pc-title-lg">{t("admin.communities.title")}</h1>
        <p className="pc-text">{t("admin.communities.intro")}</p>
        <p><Link href="/admin/communities/requests" className="underline">{crText.admin.link}{pendingRequests > 0 ? ` (${pendingRequests})` : ""}</Link></p>
        <p className="pc-meta cm-rule">{t("admin.communities.limit", { threshold: formatNumber(threshold), max })}</p>
      </section>

      {overLimit.length === 0 ? (
        <div className="notice notice-success">{t("admin.communities.over.none", { max })}</div>
      ) : (
        <div className="notice notice-danger cm-over" role="status">
          <p><b>{t("admin.communities.over.title")}</b></p>
          <p>{t("admin.communities.over.text")}</p>
          <ul>
            {overLimit.map((o) => (
              <li key={o.person}>
                {t("admin.communities.over.row", {
                  name: o.person,
                  count: o.large.length,
                  list: o.large.map((s) => `c/${s}`).join(", "),
                })}
              </li>
            ))}
          </ul>
        </div>
      )}

      {communities.length === 0 ? (
        <p className="card ad-empty">{t("admin.communities.empty")}</p>
      ) : (
        communities.map((c) => (
          <section key={c.slug} className="card ad-item">
            <div className="ad-profileTop">
              <div>
                <h2 className="pc-title cm-name">{c.name}</h2>
                <p className="pc-meta">
                  <Link href={`/c/${c.slug}`} target="_blank" rel="noopener">c/{c.slug}</Link>
                  {" · "}
                  {tn("community.members", c.members)}
                </p>
              </div>
              <div className="ad-badges">
                <span className={`pc-badge ${c.large ? "pc-badge-warning" : "pc-badge-neutral"}`}>
                  {t(c.large ? "admin.communities.large" : "admin.communities.small")}
                </span>
                {c.mods.length === 0 && <span className="pc-badge pc-badge-danger">{t("admin.communities.nomods.badge")}</span>}
              </div>
            </div>

            <div className="ad-block">
              <p className="ad-label">{t("admin.communities.mods", { count: c.mods.length })}</p>
              <ModeratorBox
                slug={c.slug}
                mods={c.mods.map((m) => ({ person: m.person, since: t("admin.communities.since", { date: dateText(m.since) }) }))}
                limits={limits}
                text={text}
              />
            </div>
          </section>
        ))
      )}
    </>
  );
}
