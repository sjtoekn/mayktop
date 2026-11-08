patch-social-newposts  (SOCIAL_TODO B4: the "n new posts" banner)

What it does:
 - On /social and /social/following (first page only) a small banner asks, about once a minute while the tab is visible
   (and at once when you come back to the tab), how many Social posts and reposts are newer than the newest one on the page.
 - If there are some, a sticky button appears: "3 new posts" ("99+ new posts" from 100). The feed NEVER changes by itself
   (nothing jumps under the reader). Only the button reloads the page and goes to the top.
 - Not counted: your own posts and reposts, blocked and muted people. On Following: only the people you follow.
 - Rate limit: 12 questions per minute and 2000 per day per person (server memory).
 - NO DATABASE CHANGE. No migration, no "prisma generate".

1. Backup:   cp -r web web-backup-before-newposts
2. In the project folder (where CHANGELOG.md is):   unzip -n patch-social-newposts.zip
   NEW files:  web/src/lib/social-new-posts.ts
               web/src/app/api/social/new-count/route.ts
               web/src/components/social/SocialNewPostsBanner.tsx
               web/scripts/test-social-new-posts.ts
               apply-social-newposts.mjs
3. node apply-social-newposts.mjs      (must end with "All done.")
   It ADDS to 12 existing files (queries.ts, site.ts, content.css, social/page.tsx, social/following/page.tsx, package.json,
   the 6 language files, CHANGELOG.md). It never replaces a whole file. Safe to run twice.
4. In web/:   npm run test:social-new-posts
              npm run check:i18n
              npm run lint
              npm run build
5. Look by hand (2 test accounts, A and B, in two browsers):
   - A opens /social and waits. B writes a post. Within a minute A sees "1 new post"; the feed has not moved.
   - A clicks it: the page reloads with B's post on top, the button is gone.
   - A blocks B (or mutes B): B's next post does NOT make a banner for A.
   - A writes a post: no banner for A.
   - /social/following: B's post makes a banner only if A follows B.
   - Faster test: in web/src/lib/social-new-posts.ts set NEW_POSTS_POLL_MS to 5000, test, then put 60_000 back.

Not run by me: the database function and the route (the zip has no node_modules); step 4 and 5 are the real check.
