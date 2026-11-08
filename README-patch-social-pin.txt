patch-social-pin  (SOCIAL_TODO B6: Pin post)   rules: ACCOUNT_RULES.md 3.18, PROVISIONAL

What it does:
 - Your OWN post cards get a "Pin / Pinned" button (only you see it). One pinned post per person: pinning another replaces it.
 - Your profile > Posts tab shows the pinned post first (first page only) with a "Pinned post" label; it is not repeated below.
 - Only your own, visible, not-deleted post can be pinned. If the post is hidden/removed it is not shown as pinned (comes back
   when restored). Deleting your own post removes its pin. Unpin always works.
 - "Download my data" has pinnedPost. Final erasure deletes the pin. Limits: 20/min, 200/day (server memory).
 - DATABASE CHANGE: 1 new table (SocialPinnedPost). The migration is in the zip.

1. Back up the project and web/dev.db.
2. In the project folder (where PROJECT.md is):   unzip -o patch-social-pin.zip
   (it adds 7 new files and REPLACES 22 existing ones (package.json, schema.prisma, CHANGELOG.md, ACCOUNT_RULES.md, the 6 language files and others); no apply script is needed. If you changed those files after this zip was made, merge by hand)
3. In web/:   npx prisma migrate dev        <-- do NOT add --name (the migration is in the zip)
              npx prisma generate
   (If it asks to reset the database or says there is drift, stop and do not answer yes.)
4. In web/:   npm run test:social-pin   npm run test:purge-social   npm run test:export-social   npm run check:i18n   npm run lint   npm run build
5. Manual test (accounts A and B):
   a. As A open your own post: "Pin" button. Click: it becomes "Pinned". Open /social/u/<A>: that post is on top with "Pinned post", once.
   b. Pin a second post: it replaces the first. The first shows "Pin" again after a reload.
   c. Click "Pinned" to unpin: the top block disappears.
   d. As B: B's cards for A's posts have NO Pin button. A's profile shows A's pinned post.
   e. Admin hides A's pinned post: it leaves the top of the profile; restore: it returns.
   f. A deletes the pinned post: no pinned block; Pin works on another post.
   g. Page 2 of the profile (Older): no pinned block.
   h. Settings > Download my data has "pinnedPost".
