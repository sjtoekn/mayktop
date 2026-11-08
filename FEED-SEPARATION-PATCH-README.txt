Mayktop Feed Separation - Phase 1 patch

This patch preserves the existing visual design and separates the feed entry points:
- Home (/) now displays Community posts only.
- /social remains the existing Social feed.
- /news is added as a News landing page placeholder.
- A shared Community / Social / News tab bar appears below the home banner and on the Social and News pages.
- News is also added to the left sidebar.

Apply from the Mayktop project root (the folder that contains web/):
  unzip -o mayktop-feed-separation-patch.zip

Then, in web/ run:
  npx prisma generate
  npm run build

No Prisma schema or database migration is included in this phase. No existing database records are changed.

Important validation note:
The supplied archive did not include node_modules, so this patch could not be fully type-checked or production-built in this environment. Run the commands above locally and share any error output before proceeding to RSS ingestion.

Next phase:
Implement NewsSource / NewsArticle storage, an admin-managed RSS source list, safe RSS polling, duplicate detection, source attribution, latest/trending feeds, and collection logs. The RSS collector is intentionally not enabled in this phase.
