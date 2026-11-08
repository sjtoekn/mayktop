import Link from "next/link";
import { formatNumber, t } from "@/i18n";
import { listPeople, parsePeopleQuery, PEOPLE_ROLES, PEOPLE_STATUSES, type PersonRow } from "@/lib/admin-people";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function statusLabel(p: Pick<PersonRow, "status" | "banned">): string {
  return p.banned ? t("admin.people.status.BANNED") : t(`admin.people.status.${p.status}`);
}

function statusBadge(p: Pick<PersonRow, "status" | "banned">): string {
  if (p.banned) return "pc-badge-danger";
  if (p.status === "ACTIVE") return "pc-badge-success";
  if (p.status === "SUSPENDED") return "pc-badge-warning";
  return "pc-badge-neutral";
}

function dateText(date: Date): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export default async function AdminPeoplePage({ searchParams }: { searchParams: SearchParams }) {
  const query = parsePeopleQuery(await searchParams);
  const { people, total, pages, page } = await listPeople(query);

  function link(target: number): string {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.status) params.set("status", query.status);
    if (query.role) params.set("role", query.role);
    if (target > 1) params.set("page", String(target));
    const text = params.toString();
    return text ? `/admin/people?${text}` : "/admin/people";
  }
  const filtered = Boolean(query.q || query.status || query.role);

  return (
    <>
      <section className="ad-head">
        <h1 className="pc-title pc-title-lg">{t("admin.people.title")}</h1>
        <p className="pc-text">{t("admin.people.intro")}</p>
      </section>

      <form className="card ad-filters" method="get" action="/admin/people" role="search">
        <div className="ad-filterField ad-filterGrow">
          <label className="sf-label" htmlFor="ad-q">{t("admin.people.search.label")}</label>
          <input id="ad-q" name="q" className="pc-field" type="search" maxLength={100} defaultValue={query.q} placeholder={t("admin.people.search.placeholder")} />
        </div>
        <div className="ad-filterField">
          <label className="sf-label" htmlFor="ad-status">{t("admin.people.filter.status")}</label>
          <select id="ad-status" name="status" className="pc-field" defaultValue={query.status}>
            <option value="">{t("admin.people.filter.all")}</option>
            {PEOPLE_STATUSES.map((s) => (
              <option key={s} value={s}>{t(`admin.people.status.${s}`)}</option>
            ))}
          </select>
        </div>
        <div className="ad-filterField">
          <label className="sf-label" htmlFor="ad-role">{t("admin.people.filter.role")}</label>
          <select id="ad-role" name="role" className="pc-field" defaultValue={query.role}>
            <option value="">{t("admin.people.filter.all")}</option>
            {PEOPLE_ROLES.map((r) => (
              <option key={r} value={r}>{t(`admin.people.role.${r}`)}</option>
            ))}
          </select>
        </div>
        <div className="ad-filterButtons">
          <button type="submit" className="btn btn-primary">{t("admin.people.search.button")}</button>
          {filtered && (
            <Link href="/admin/people" className="btn btn-ghost">{t("admin.people.reset")}</Link>
          )}
        </div>
      </form>

      <p className="pc-meta" role="status">{t("admin.people.count", { count: formatNumber(total) })}</p>

      {people.length === 0 ? (
        <p className="card ad-empty">{t("admin.people.empty")}</p>
      ) : (
        <div className="card ad-tableWrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th scope="col">{t("admin.people.col.person")}</th>
                <th scope="col">{t("admin.people.col.status")}</th>
                <th scope="col">{t("admin.people.col.role")}</th>
                <th scope="col">{t("admin.people.col.joined")}</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.username}>
                  <td>
                    <Link href={`/admin/people/${encodeURIComponent(p.username)}`} className="ad-person">
                      <b>{p.displayName || p.username}</b>
                      <span className="pc-meta">@{p.username} · {p.email}</span>
                    </Link>
                  </td>
                  <td><span className={`pc-badge ${statusBadge(p)}`}>{statusLabel(p)}</span></td>
                  <td>
                    <span className={`pc-badge ${p.role === "ADMIN" ? "pc-badge-info" : "pc-badge-neutral"}`}>
                      {t(`admin.people.role.${p.role}`)}
                    </span>
                  </td>
                  <td className="pc-meta">{dateText(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="ad-pager" aria-label={t("admin.people.page", { page: formatNumber(page), pages: formatNumber(pages) })}>
          {page > 1 ? (
            <Link href={link(page - 1)} className="btn btn-secondary btn-sm">{t("admin.people.prev")}</Link>
          ) : (
            <span className="btn btn-secondary btn-sm" aria-disabled="true">{t("admin.people.prev")}</span>
          )}
          <span className="pc-meta">{t("admin.people.page", { page: formatNumber(page), pages: formatNumber(pages) })}</span>
          {page < pages ? (
            <Link href={link(page + 1)} className="btn btn-secondary btn-sm">{t("admin.people.next")}</Link>
          ) : (
            <span className="btn btn-secondary btn-sm" aria-disabled="true">{t("admin.people.next")}</span>
          )}
        </nav>
      )}
    </>
  );
}
