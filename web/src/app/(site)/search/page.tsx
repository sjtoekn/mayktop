import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Icon from "@/components/shell/Icon";
import PostCard from "@/components/PostCard";
import { t, tn } from "@/i18n";
import { communityIcon } from "@/data/sample";
import { searchContent } from "@/lib/queries";

export const metadata: Metadata = { title: t("search.title") };

function Head({ q }: { q: string }) {
  return (
    <header className="card pg-head">
      <h1 className="sf-h1">{q ? t("search.summary", { q }) : t("search.title")}</h1>
      {!q && <p className="pc-text">{t("search.prompt")}</p>}
    </header>
  );
}

// searchParams is read per request, so it must sit inside <Suspense>
// (Cache Components rule, same as /submit).
async function Results({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: raw } = await searchParams;
  const q = (raw ?? "").trim().slice(0, 100);
  const { communities, posts } = await searchContent(q);

  return (
    <>
      <Head q={q} />

      {q && communities.length === 0 && posts.length === 0 && (
        <div className="card pg-empty">
          <p>{t("search.empty", { q })}</p>
        </div>
      )}

      {communities.length > 0 && (
        <>
          <div className="pc-sectionbar"><h2>{t("search.communities")}</h2></div>
          <div className="ex-grid">
            {communities.map((c, i) => (
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
        </>
      )}

      {posts.length > 0 && (
        <>
          <div className="pc-sectionbar"><h2>{t("search.posts")}</h2></div>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </>
      )}
    </>
  );
}

export default function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <Suspense fallback={<Head q="" />}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}
