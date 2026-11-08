import Link from "next/link";
import { formatNumber, t } from "@/i18n";
import { getOverview } from "@/lib/admin";

export default async function AdminOverviewPage() {
  const { totals, waiting } = await getOverview();

  const stats = [
    { label: t("admin.stat.users"), value: totals.users },
    { label: t("admin.stat.communities"), value: totals.communities },
    { label: t("admin.stat.posts"), value: totals.posts },
    { label: t("admin.stat.comments"), value: totals.comments },
  ];
  // href only where the screen exists; each new part adds its own link.
  const todo: { label: string; value: number; href?: string }[] = [
    { label: t("admin.todo.reports"), value: waiting.reports },
    { label: t("admin.todo.appeals"), value: waiting.appeals, href: "/admin/appeals" },
    { label: t("admin.todo.review"), value: waiting.review, href: "/admin/review" },
    { label: t("admin.todo.bans"), value: waiting.bans, href: "/admin/bans" },
    { label: t("admin.todo.ads"), value: waiting.ads, href: "/admin/ads" },
  ];
  const nothing = todo.every((item) => item.value === 0);

  return (
    <>
      <section className="ad-head">
        <h1 className="pc-title pc-title-lg">{t("admin.overview.title")}</h1>
        <p className="pc-text">{t("admin.overview.intro")}</p>
      </section>

      <section className="ad-stats">
        {stats.map((s) => (
          <div key={s.label} className="card ad-stat">
            <span className="ad-statValue">{formatNumber(s.value)}</span>
            <span className="pc-meta">{s.label}</span>
          </div>
        ))}
      </section>

      <section className="card ad-todo" aria-labelledby="ad-todo-title">
        <h2 id="ad-todo-title" className="pc-title">{t("admin.todo.title")}</h2>
        {nothing ? (
          <p className="ad-clear">{t("admin.todo.none")}</p>
        ) : (
          <ul className="ad-todoList">
            {todo.map((item) => (
              <li key={item.label} className="ad-todoRow">
                {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
                <span className={`pc-badge ${item.value > 0 ? "pc-badge-warning" : "pc-badge-neutral"}`}>
                  {formatNumber(item.value)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
