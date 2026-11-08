import "./news.css";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { addNewsSource, collectNewsAction, setNewsSourceEnabled } from "./actions";

export const metadata = { title: "News sources | Mayktop Admin", robots: { index: false, follow: false } };

export default async function AdminNewsPage() {
  await requireAdmin();
  const sources = await prisma.newsSource.findMany({
    orderBy: [{ enabled: "desc" }, { name: "asc" }],
    include: { _count: { select: { articles: true } } },
  });

  return (
    <>
      <section className="ad-head">
        <h1 className="pc-title pc-title-lg">News sources</h1>
        <p className="pc-text">Manage approved RSS and Atom feeds. Imported stories link readers to the original publisher.</p>
      </section>

      <section className="card ad-item">
        <h2 className="pc-title">Add a news source</h2>
        <form action={addNewsSource} className="news-admin-form">
          <label>Publisher name<input name="name" required maxLength={100} placeholder="BBC News" /></label>
          <label>RSS / Atom feed URL<input name="feedUrl" type="url" required placeholder="https://example.com/rss.xml" /></label>
          <label>Publisher website (optional)<input name="siteUrl" type="url" placeholder="https://example.com" /></label>
          <button className="btn btn-primary" type="submit">Add source</button>
        </form>
        <p className="pc-meta">Only add feeds you trust and are permitted to display. Feed URLs must be public HTTP(S) addresses.</p>
      </section>

      <section className="news-admin-toolbar">
        <div>
          <h2 className="pc-title">Configured sources ({sources.length})</h2>
          <p className="pc-meta">Sources are disabled rather than deleted, so their imported article history is preserved.</p>
        </div>
        <form action={collectNewsAction}>
          <button className="btn btn-primary" type="submit">Run collector now</button>
        </form>
      </section>

      {sources.length === 0 ? (
        <p className="card ad-empty">No news sources have been added yet.</p>
      ) : sources.map((source) => (
        <article className="card news-source-item" key={source.id}>
          <div className="news-source-info">
            <h3 className="pc-title">{source.name}</h3>
            <p className="pc-meta">{source.feedUrl}</p>
            <p className="pc-meta">
              {source._count.articles} articles · {source.enabled ? "Enabled" : "Disabled"}
              {source.lastSuccessAt ? ` · Last success: ${source.lastSuccessAt.toISOString()}` : " · Not collected yet"}
            </p>
            {source.lastError && <p className="news-source-error">Last error: {source.lastError}</p>}
          </div>
          <form action={setNewsSourceEnabled}>
            <input type="hidden" name="id" value={source.id} />
            <input type="hidden" name="enabled" value={String(!source.enabled)} />
            <button className="btn btn-ghost btn-sm" type="submit">{source.enabled ? "Disable" : "Enable"}</button>
          </form>
        </article>
      ))}
    </>
  );
}
