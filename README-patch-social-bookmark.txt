patch-social-bookmark  (SOCIAL_TODO B2: Bookmarks)

What it does (rules: ACCOUNT_RULES.md 3.17, PROVISIONAL):
 - Every Social post card (Home, /social, Following, hashtag pages, profile tabs, the post's own page) has a new "Save / Saved" button.
 - New page /social/bookmarks (login only): the posts you saved, the most recently SAVED first, 50 per page with an "Older" link.
   There is a new "Bookmarks" tab next to "All" and "Following".
 - PRIVATE: only you see your list. No count on the post (not even for its author), nobody is notified, nothing about bookmarks is
   in the shared feed caches (it is asked per request, like likes).
 - Saving needs a visible post by an account that may be shown, and no Block between you and the author (same "not found").
   A muted person's post can be saved. Removing a bookmark always works. Limit: 2000 bookmarks per person; 60 saves per minute and
   600 per day (server memory, TODO 50).
 - The list leaves out posts that are hidden, removed or deleted (they come back with the post) and posts of a person who blocked
   you or whom you blocked. A muted person's saved post stays in the list.
 - "Download my data" lists the post numbers you saved. Final erasure deletes your bookmarks and the bookmarks of your posts.
 - DATABASE CHANGE: 1 new table (SocialPostBookmark). The migration is ready in the zip.

1. Make a backup zip of the project (and of web/dev.db).
2. In the project folder (where PROJECT.md is):   unzip -o patch-social-bookmark.zip
   NEW files:  web/src/lib/social-bookmark-rules.ts, social-bookmark.ts, social-bookmark-view.ts
               web/src/app/(site)/social/bookmark/actions.ts
               web/src/app/(site)/social/bookmarks/page.tsx
               web/src/components/social/SocialBookmarkButton.tsx
               web/prisma/migrations/20261112090000_social_bookmarks/migration.sql
               web/scripts/test-social-bookmark.ts
               apply-social-bookmark.mjs, i18n-social-bookmark/ (6 small text files), docs-social-bookmark/ (4 small text files)
3. node apply-social-bookmark.mjs      (must end with "All done.")
   It edits 21 existing files (schema.prisma, site.ts, queries.ts, SocialPostCard, SocialRepostCard, SocialFeedList, SocialFeedTabs,
   the post page /social/[id], the Home page, purge-social.ts, export-social.ts, content.css, package.json, the 6 language files,
   CHANGELOG.md, ACCOUNT_RULES.md). It can be run twice safely.
4. In web/:   npx prisma migrate dev        <-- do NOT add --name: the migration already exists in the zip
              npx prisma generate
   (If it asks to reset the database or says there is drift, stop and send me the screen; do not answer yes.)
5. In web/:   npm run test:social-bookmark   npm run test:social-block   npm run test:purge-social   npm run test:export-social
              npm run check:i18n   npm run lint   npm run build
6. Manual test (two accounts, A and B; B has some posts):
   a. As A open /social. Every post has a "Save" button. Click it on two of B's posts: it becomes "Saved". Reload: still "Saved".
   b. Open /social/bookmarks (new tab "Bookmarks"): the 2 posts, the one you saved LAST on top. Click "Saved" on one: the button
      goes back to "Save" (the post leaves the list after you reload the page).
   c. As B: there is no number or sign anywhere that A saved the post, and no notification in the bell.
   d. As B hide or delete one of the posts A saved (admin hide, or Delete): it leaves A's list. If an admin restores it, it comes back.
   e. As A block B (profile > Block): B's posts leave the Bookmarks list. Unblock: they come back. While blocked, a stale tab with
      "Save" on a B post gives the error text and saves nothing.
   f. As A mute B: B's posts stay in the Bookmarks list.
   g. Save a post on Home (/), on /social/following, on a hashtag page, on a profile page, and on the post's own page: the button
      works everywhere and shows "Saved" again after a reload. A plain repost shows the button for the ORIGINAL post.
   h. Open /social/bookmarks as a visitor (logged out): the log-in message, nothing is read.
   i. "Download my data" (Settings) now has a "bookmarks" list.
7. Tick B2 in your Social list when everything passes.

Not in this patch on purpose: folders or tags for bookmarks, a "Bookmarks" tab on your own profile, saving a reply or a community post
here (community posts already have /saved), a note on a bookmark, a "no longer available" line for a deleted post, a Save button on the
quoted box inside a quote repost (the original is one click away), a shared (many-server) rate limiter (TODO 50).
