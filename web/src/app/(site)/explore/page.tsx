import Link from "next/link";
import Icon from "@/components/shell/Icon";
import { t, tn } from "@/i18n";
import { communityIcon } from "@/data/sample";
import { getCommunities } from "@/lib/queries";
import { communityCategories } from "@/config/site";

export default async function ExplorePage() {
  const communities = await getCommunities();
  // Grouped by topic (SITE_PLAN A2). `i` is the place in the whole list, so the colours of the cards stay as they were.
  // A stored topic that is no longer in the list is shown under "other"; empty topics are left out.
  const known = new Set<string>(communityCategories);
  const groups = communityCategories
    .map((key) => ({
      key,
      items: communities
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => (known.has(c.category) ? c.category : "other") === key),
    }))
    .filter((group) => group.items.length > 0);
  return (
    <>
      <header className="card pg-head">
        <h1 className="sf-h1">{t("explore.title")}</h1>
        <p className="pc-text">{t("explore.sub")}</p>
      </header>

      {groups.map((group) => (
      <section key={group.key} aria-labelledby={`ex-cat-${group.key}`}>
      <h2 id={`ex-cat-${group.key}`} className="sf-h2">{t(`community.category.${group.key}`)}</h2>
      <div className="ex-grid">
        {group.items.map(({ c, i }) => (
          <Link key={c.slug} href={`/c/${c.slug}`} className="card card-link ex-card">
            <span className={`pc-avatar pc-a${(i % 5) + 1}`} aria-hidden="true">
              <Icon name={communityIcon[c.slug] ?? "users"} size={24} />
            </span>
            <div className="ex-body">
              <h2>{c.name}</h2>
              <p>{c.description}</p>
              <small>{tn("community.members", c.members)}</small>
            </div>
            <span className="ex-open">{t("explore.open")} <Icon name="chevron" size={16} /></span>
          </Link>
        ))}
      </div>
      </section>
      ))}
    </>
  );
}
