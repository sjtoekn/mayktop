patch-social-block  (SOCIAL_TODO A7: Block and Mute)

What it does (rules: ACCOUNT_RULES.md 3.16, PROVISIONAL):
 - On a Social profile (/social/u/<username>) there are two new buttons: Mute and Block. Block asks "Are you sure?" first.
 - BLOCK (A blocks B): B cannot follow A, like, repost, quote, reply to or mention A. Any follow between them (both ways) is removed
   and does not come back after Unblock. A and B never see each other's posts, reposts, replies or quotes (Home, /social,
   /social/following, hashtag pages, post page, profile tabs, notifications). B is never told: B's refused actions show the same
   "not found" as for a hidden post, and B gets "not found" on A's profile and posts. A sees a short page on B's profile with the
   button "Blocked" (click = Unblock).
 - MUTE (A mutes B): A no longer sees B's posts, reposts and replies in feeds and under posts, and gets no notification (list and
   bell) caused by B. Nothing is refused to B, nobody is told, A's follow stays. B's own profile and post pages still open for A
   (a note on the profile says "You muted ...").
 - Unblock and unmute are always allowed. You cannot block or mute yourself. Limit: 30 per minute and 300 per day, Block and Mute together.
 - The lists are applied AFTER the shared feed cache (the cached feeds hold no personal data), per request. If the database fails the
   page fails; it never shows what the person blocked.
 - "Download my data" now lists the people you blocked and muted (never who blocked you). Final erasure removes every block and mute
   made or received.
 - DATABASE CHANGE: 2 new tables (SocialBlock, SocialMute). The migration is ready in the zip.

1. Make a backup zip of the project (and of web/dev.db).
2. In the project folder (where PROJECT.md is):   unzip -o patch-social-block.zip
   NEW files:  web/src/lib/social-block-rules.ts, social-block.ts, social-block-view.ts
               web/src/app/(site)/social/block/actions.ts
               web/src/components/social/SocialBlockButtons.tsx, socialBlockProps.ts
               web/prisma/migrations/20261111090000_social_block/migration.sql
               web/scripts/test-social-block.ts
               apply-social-block.mjs, i18n-social-block/ (6 small text files), docs-social-block/ (2 small text files)
3. node apply-social-block.mjs      (must end with "All done.")
   It edits 29 existing files (schema.prisma, site.ts, social-follow.ts, social-reply.ts, social-repost.ts, social-tag-sync.ts,
   social-notifications.ts, purge-social.ts, export-social.ts, social/like/actions.ts, Home page, /social, /social/following,
   /social/tag/[tag], /social/[id], /social/u/[username], 4 older test scripts, package.json, the 6 language files, CHANGELOG.md,
   ACCOUNT_RULES.md). It can be run twice safely.
4. In web/:   npx prisma migrate dev        <-- do NOT add --name: the migration already exists in the zip
              npx prisma generate
   (The folder is named 20261111090000 so it sorts AFTER the last applied migration. If it still asks to reset the database or says
   there is drift, stop and send me the screen; do not answer yes.)
5. In web/:   npm run test:social-block   npm run test:social-follow   npm run test:social-repost   npm run test:social-reply
              npm run test:social-tags   npm run test:purge-social   npm run test:export-social
              npm run check:i18n   npm run lint   npm run build
6. Manual test (three accounts, A, B and C; A follows B and B follows A):
   a. As A open /social/u/<B>. Click Block, then "Yes, block". The page now says you blocked B, with the button "Blocked".
      Open /social/u/<A> as B: it is "not found". B's and A's follower / following counts dropped by the removed follows.
   b. As A: B's posts are gone from Home, /social, /social/following, a hashtag page, and the replies under C's posts.
      As B: A's posts are gone from the same places. B opening /social/<one of A's posts> is "not found".
   c. As B (with an old tab of A's post open): Like, Repost and Reply give an error and save nothing. A's bell does not change.
   d. As B write "hello @A": it is saved, @A is plain text (not a link), A gets no notification.
   e. As A click "Blocked" (Unblock): B's posts come back. The follows do NOT come back (follow again by hand).
   f. As A open /social/u/<C> and click Mute: C's posts leave Home, /social, /social/following, hashtag pages and replies under posts.
      /social/u/<C> still opens with the note "You muted ..." and its Posts tab still lists C's posts. /social/<C's post> opens.
   g. As C like and reply to A's post: A's bell and /notifications show nothing from C. Click "Muted" (Unmute): everything is back,
      including the notifications.
   h. As A, mute a person with MANY posts so the first page of /social shows no items: "Older posts" is still there.
   i. /admin/social, reports and appeals work as before (an admin still sees every post there).
   j. "Download my data" (Settings) has "blocked" and "muted" lists.
7. Tick SOCIAL_TODO A7 when everything passes.

Not in this patch on purpose: a Settings page that lists everyone you blocked or muted (to unblock without finding the profile),
Block / Mute on a post card or on the Followers list, mute for a set time, muting words, Block for Community posts, hashtags and
mentions in replies, a limit on the size of a block list, block counts for moderators. The like, repost and reply COUNTS on a post
still include blocked and muted people. Search (B1) does not exist yet: when it does, it must use loadHiddenAuthors too.
