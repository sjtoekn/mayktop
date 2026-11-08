patch-social-views  (SOCIAL_TODO B5: view counts on the Social post card)

What was already there: Like, Repost and Reply counts on every card. What this adds: a view figure "👁 1.3K".

Decision (2026-11-08): ONE running total per post that keeps growing (SocialPost.viewCount). Nothing about WHO looked is saved:
no user id, no IP, no table. A bare total is not personal data, so it can be kept for as long as the post exists.
Like YouTube / Facebook, only REAL views count:
 - at least half of the card on screen for 1 second;
 - logged-in people only; not crawlers or scripts; never the author's own view;
 - the same person adds at most 1 view per post per 24 hours (the server remembers "<person>:<post>" in MEMORY only,
   never on disk, gone at restart: after a restart one more view can count, so the total is close, not exact);
 - rate limit per person: 120 per minute and 5000 per day (server memory).
The number on the card does not change while the page is open. Reply / Repost / Like counts are unchanged.

1. Backup:   cp -r web web-backup-before-views     (and copy web/dev.db too)
2. In the project folder (where CHANGELOG.md is):   unzip -n patch-social-views.zip
   NEW files:  web/src/lib/social-views.ts
               web/src/lib/social-view-db.ts
               web/src/app/api/social/view/route.ts
               web/src/components/social/SocialViewCount.tsx
               web/scripts/test-social-views.ts
               web/prisma/migrations/20261113090000_social_post_views/migration.sql
               apply-social-views.mjs
3. node apply-social-views.mjs      (must end with "All done.")
   It ADDS to 13 existing files (schema.prisma, queries.ts, site.ts, SocialPostCard.tsx, content.css, package.json,
   the 6 language files, CHANGELOG.md). It never replaces a whole file. Safe to run twice.
4. In web/:   npx prisma migrate dev        (applies "social_post_views": one new column, default 0)
              npx prisma generate
              npm run test:social-views
              npm run check:i18n
              npm run lint
              npm run build
5. Look by hand (2 test accounts, A and B, in two browsers):
   - A opens /social and B's post stays on screen for a second: reload as A: the figure on B's post goes from 0 to 1.
   - A reloads again and looks at the same post: still 1 (same person, same day).
   - B looks at B's own post: no change.  A third account C looks: 2.
   - Scroll past a post quickly (under a second): no change.
   - Logged out: /social shows no posts, so nothing is counted.
   - Tooltip on the figure explains what is counted; a screen reader says "1 view".
   - Faster test of the 24-hour rule: restart `npm run dev`, then A looks at the same post again: it counts once more (expected).

Please also add one sentence to your privacy text (handled separately): "We keep a running total of how many times a post
was viewed. We do not save who viewed it."

Not run by me: the migration, the route and the page (the zip has no node_modules); step 4 and 5 are the real check.
