MAYKTOP NEWS + RSS COLLECTOR PATCH
=================================

This patch adds an independent News data layer. Existing Community and Social models,
posts, permissions and feed queries are not changed.

WHAT IT ADDS
------------
- NewsSource and NewsArticle Prisma models.
- SQLite migration: 20261113090000_news_discovery.
- Public /news page with category filters and original-publisher links.
- Admin > News sources page to add, enable and disable RSS/Atom feeds.
- "Run collector now" action for an admin.
- CLI collector command: npm run news:collect.
- Duplicate protection by canonical URL and source GUID.
- Basic public-URL validation, feed size limits and request timeouts.

APPLY
-----
1. Stop the Next.js dev server (Ctrl+C).
2. From the Mayktop project root, extract this ZIP with overwrite enabled.
   The ZIP paths start with web/, so extract into the project root, NOT inside web/.
3. In Terminal:

   cd /Users/wadiya/Downloads/7-mayktop/web
   npx prisma migrate deploy
   npx prisma generate
   npm run build

4. Start the site:

   npm run dev

5. Sign in as an Admin and open:
   http://localhost:3000/admin/news

6. Add trusted publisher RSS/Atom feed URLs, then press "Run collector now".
   Imported headlines appear at:
   http://localhost:3000/news

SCHEDULING
----------
The collector is intentionally not started as a background thread inside Next.js.
For reliable scheduled collection, use cron or your hosting provider's scheduler.
On this Mac, after testing manually, an example 15-minute cron entry is:

*/15 * * * * cd /Users/wadiya/Downloads/7-mayktop/web && npm run news:collect >> /Users/wadiya/Downloads/7-mayktop/web/news-collector.log 2>&1

Edit it with: crontab -e
Remove the line to stop scheduled collection.

NOTES
-----
- The collector processes up to 8 enabled feeds per run and up to 40 items per feed.
- It uses RSS/Atom feed metadata and stores headline, short summary, publisher, image URL,
  category, publication date and original article URL. It does not copy full articles.
- Run the collector every 15 minutes or less often according to the publisher's feed terms.
- Start with a small number of sources and check each source's feed URL and permissions.
- Redirects are not followed; if a publisher's feed redirects, use its final feed URL.
- "Trending" is not yet claimed because reliable click/view/share event tracking has not been
  added. This phase provides Latest and category-filtered News. Trending comes after analytics.
- Keep a backup of web/dev.db before applying database migrations.
