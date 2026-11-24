import type { Metadata } from "next";
import { Suspense } from "react";
import "./news.css";
import Link from "next/link";
import { connection } from "next/server";
import Icon from "@/components/shell/Icon";
import PageHero from "@/components/PageHero";
import { t } from "@/i18n";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "News | Falvenco",
  description: "Latest headlines from approved publishers.",
};

const CATEGORIES = [
  "ALL",
  "WORLD",
  "BUSINESS",
  "TECHNOLOGY",
  "SPORTS",
  "HEALTH",
  "GENERAL",
] as const;

// Thumbnail used when a story has no picture: the same look as the community post thumbnails.
const CATEGORY_ART: Record<string, { emoji: string; gradient: string }> = {
  WORLD: { emoji: "🌍", gradient: "linear-gradient(135deg,#7fd8ff,#2ec4b6)" },
  BUSINESS: { emoji: "💼", gradient: "linear-gradient(135deg,#ffd28a,#e07a1f)" },
  TECHNOLOGY: { emoji: "💻", gradient: "linear-gradient(135deg,#3a86ff,#0a1f5c)" },
  SPORTS: { emoji: "⚽", gradient: "linear-gradient(135deg,#8ee6b0,#1b9e5a)" },
  HEALTH: { emoji: "🩺", gradient: "linear-gradient(135deg,#ffb3c1,#e5546f)" },
  GENERAL: { emoji: "📰", gradient: "linear-gradient(135deg,#c7b8ff,#6d4aff)" },
};

function dateLabel(date: Date | null): string {
  if (!date) return "Recently added";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** WordPress feeds end the summary with "Continue Reading The post ... appeared first on X ." Remove that. */
function cleanSummary(text: string): string {
  return text
    .replace(/\s*The post .{0,300}? appeared first on .*$/is, "")
    .replace(/\s*(?:Continue Reading|Read more|Read More)\s*[.…]*\s*$/i, "")
    .trim();
}

function summaryOf(summary: string | null): string {
  return summary ? cleanSummary(summary) : "";
}

function NewsLoading() {
  return (
    <>
      <PageHero variant="news" parts={[t("news.hero.a"), t("news.hero.b"), t("news.hero.c")]} sub={t("news.hero.sub")} />
      <section className="card pg-empty">
        <span className="pc-avatar pc-a4" aria-hidden="true">
          <Icon name="newspaper" size={26} />
        </span>
        <h2>Loading news...</h2>
        <p>Please wait while the latest headlines are loaded.</p>
      </section>
    </>
  );
}

async function NewsContent({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await connection();

  const params = await searchParams;
  const requested = (params.category ?? "ALL").toUpperCase();

  const category = (CATEGORIES as readonly string[]).includes(requested)
    ? requested
    : "ALL";

  const articles = await prisma.newsArticle.findMany({
    where: category === "ALL" ? {} : { category },
    orderBy: [
      { publishedAt: "desc" },
      { fetchedAt: "desc" },
    ],
    take: 40,
    include: {
      source: {
        select: {
          name: true,
          siteUrl: true,
        },
      },
    },
  });

  return (
    <>
      <PageHero variant="news" parts={[t("news.hero.a"), t("news.hero.b"), t("news.hero.c")]} sub={t("news.hero.sub")} />

      <nav className="news-categories" aria-label="News categories">
        {CATEGORIES.map((item) => (
          <Link
            key={item}
            href={item === "ALL" ? "/news" : `/news?category=${item}`}
            className={`news-category${
              category === item ? " is-active" : ""
            }`}
          >
            {item === "ALL"
              ? "Latest"
              : item[0] + item.slice(1).toLowerCase()}
          </Link>
        ))}
      </nav>

      {articles.length === 0 ? (
        <section className="card pg-empty">
          <span className="pc-avatar pc-a4" aria-hidden="true">
            <Icon name="newspaper" size={26} />
          </span>
          <h2>
            {category === "ALL"
              ? "News is being prepared"
              : "No stories in this category yet"}
          </h2>
          <p>
            Falvenco will show headlines from approved RSS publishers here.
            New stories appear after the news collector runs.
          </p>
        </section>
      ) : (
        <section className="news-feed" aria-label="Latest news">
          {articles.map((article) => {
            const art = CATEGORY_ART[article.category] ?? CATEGORY_ART.GENERAL;
            const tone = ((article.source.name.charCodeAt(0) || 0) % 5) + 1;
            const summary = summaryOf(article.summary);
            return (
              <article className="card pc-post pc-cp news-card" key={article.id}>
                <div className={`pc-avatar pc-a${tone}`} aria-hidden="true">
                  {article.source.name.charAt(0).toUpperCase()}
                </div>

                <div className="pc-body">
                  <div className="pc-meta">
                    <strong className="news-source">{article.source.name}</strong>
                    {" · "}
                    {dateLabel(article.publishedAt)}
                  </div>

                  <h2 className="pc-title">
                    <a href={article.url} target="_blank" rel="noopener noreferrer">
                      {article.title}
                    </a>
                  </h2>

                  {summary && (
                    <p className="pc-text line-clamp-3">
                      {summary.slice(0, 320)}
                      {summary.length > 320 ? "…" : ""}
                    </p>
                  )}

                  <div className="pc-actions">
                    <span className="pc-pill news-catPill">
                      <Icon name="newspaper" size={18} /> {article.category[0] + article.category.slice(1).toLowerCase()}
                    </span>
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pc-pill news-readPill"
                    >
                      Read at {article.source.name} <Icon name="arrowright" size={18} />
                    </a>
                  </div>
                </div>

                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pc-thumb news-thumb"
                  style={article.imageUrl ? undefined : { background: art.gradient }}
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  {article.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={article.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  ) : (
                    art.emoji
                  )}
                </a>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}

export default function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  return (
    <Suspense fallback={<NewsLoading />}>
      <NewsContent searchParams={searchParams} />
    </Suspense>
  );
}
