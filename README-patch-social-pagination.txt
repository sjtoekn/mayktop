patch-social-pagination  (SOCIAL_TODO 4: Feed pagination)

What it does:
 - /social and /social/following show 50 items per page. Under them: an "Older posts" link (plain link, no script).
   Later pages have "Back to the newest posts"; the last page says there is nothing older.
 - Nothing is skipped or shown twice, also when several posts have exactly the same time.
 - NO database change. NO new setting.

1. Make a backup zip of the project.
2. In the project folder (where PROJECT.md is):   unzip -o patch-social-pagination.zip
   NEW files:  web/src/lib/social-paging.ts
               web/src/components/social/SocialFeedPager.tsx
               web/scripts/test-social-paging.ts
               apply-social-pagination.mjs, i18n-social-pagination/ (6 small text files)
3. node apply-social-pagination.mjs      (must end with "All done.")
   It edits 10 existing files (queries.ts, social/page.tsx, social/following/page.tsx, content.css, package.json,
   the 6 language files, CHANGELOG.md). It can be run twice safely.
4. In web/:  npm run test:social-paging   npm run check:i18n   npm run lint   npm run build
5. Manual test: you need more than 50 Social items. Quick way: change
   SOCIAL_FEED_SIZE in web/src/lib/queries.ts from 50 to 3 for the test only, and put it back to 50 afterwards.
   a. /social: 3 posts and "Older posts". Click it: the next 3, "Back to the newest posts" and "Older posts".
   b. On the last page: "You have reached the end." and no "Older posts".
   c. Same on /social/following.
   d. /social?before=abc and /social?before=1.2.3 : the first page (a bad cursor is ignored, no error).
   e. Hide a post from the page you were on (/admin/social), then go "Older posts": no error, no post twice.
6. Tick SOCIAL_TODO 4 when everything passes.

Not in this patch on purpose: the Home page (/) still shows its newest 50 mixed items; the "n new posts" banner (B4);
infinite scroll (plain links work with the keyboard and screen readers).
