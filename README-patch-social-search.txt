patch-social-search  (SOCIAL_TODO B1: Search in Social)

What it does:
 - New page /social/search with 3 tabs: Posts | People | Hashtags. A search box is also under the title on /social.
 - Only for logged-in people (like all of Social). The page is noindex. A visitor sees the log-in message.
 - Posts: every word must be in the text; newest first; "Older posts" paging.
 - People: username or name; exact match first, then names that start with the text; Follow button.
 - Hashtags: exact first, then most recently used; links to /social/tag/<tag>. "#colombo" opens this tab by itself, "@maya" opens People.
 - Never ordered by popularity. Hidden / removed / deleted posts and accounts that are not shown never appear.
 - Blocked people (either way) never appear. Muted people's posts are hidden, their account can still be found.
 - Rate limit: 30 searches per minute and 600 per day per person (server memory, like the other Social limits).
 - NO DATABASE CHANGE. No migration, no "prisma generate".

1. Make a backup zip of the project.
2. In the project folder (where CHANGELOG.md is):   unzip -o patch-social-search.zip
   NEW files:  web/src/lib/social-search.ts
               web/src/components/social/SocialSearchForm.tsx, SocialSearchTabs.tsx
               web/src/app/(site)/social/search/page.tsx
               web/scripts/test-social-search.ts
   CHANGED files (whole files, replaced): web/src/lib/queries.ts (3 functions added at the end + 1 import),
               web/src/config/site.ts (socialLimits.searches), web/src/app/content.css (5 rules at the end),
               web/src/app/(site)/social/page.tsx (search box), web/src/components/social/SocialFeedPager.tsx,
               web/package.json (test:social-search), the 6 language files (17 texts each), CHANGELOG.md
   If you changed any of these files after your last zip, compare before you overwrite.
3. In web/:   npm run test:social-search     (must end with "All Social search tests passed.")
              npm run check:i18n
              npm run lint
              npm run build
4. Look by hand (logged in, with 2 test accounts):
   - /social/search?q=<a word from a post>   -> the post; "Older posts" appears after 50 results
   - tab People: search a username, a part of a name, "@" + username -> Follow button works
   - tab Hashtags: "#colombo" -> opens the Hashtags tab, click opens /social/tag/colombo
   - hide a post (admin) -> it disappears from search; block someone -> they vanish from all 3 tabs
   - logged out: /social/search?q=x shows only the log-in message

Not checked by me: the 3 database functions and the page were written against your code and types but NOT run
(the zip has no node_modules), so step 3 (lint / build) and step 4 are the real check. Send me the first error if any.
