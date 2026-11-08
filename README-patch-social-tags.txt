patch-social-tags  (SOCIAL_TODO 6: Hashtags and @mentions)

What it does:
 - In a Social post, #hashtag and @username are links. A hashtag opens /social/tag/<tag> (the Social posts that use it,
   newest first, "Older posts" paging). A mention opens the profile AND notifies that person
   ("<name> mentioned you in a post", on /notifications and in the bell).
 - Works with Sinhala, Hindi, Arabic and Chinese hashtags. #Colombo and #colombo are one hashtag.
 - Limits (PROJECT.md 8j.6, provisional): 10 different hashtags and 5 different mentions count per post; the extra ones stay
   plain text (no error). One notification per person per post, ever. Nobody is notified about their own mention.
 - Only accounts that exist and may be shown can be mentioned; any other @name stays plain text.
 - Deleting your post, or erasing an account, removes its hashtags and mentions.
 - DATABASE CHANGE: 2 new tables (SocialPostTag, SocialMention). The migration is ready in the zip.

1. Make a backup zip of the project (and of web/dev.db).
2. In the project folder (where PROJECT.md is):   unzip -o patch-social-tags.zip
   NEW files:  web/src/lib/social-tags.ts, web/src/lib/social-tag-sync.ts
               web/src/components/social/SocialBody.tsx
               web/src/app/(site)/social/tag/[tag]/page.tsx
               web/prisma/migrations/20261109100000_social_tags/migration.sql
               web/scripts/test-social-tags.ts
               apply-social-tags.mjs, i18n-social-tags/ (6 small text files)
3. node apply-social-tags.mjs      (must end with "All done.")
   It edits 20 existing files (schema.prisma, queries.ts, SocialPostCard.tsx, social/submit/actions.ts,
   social/manage/actions.ts, social-notifications.ts, notifications/page.tsx, purge-social.ts, content.css, package.json,
   the 6 language files, CHANGELOG.md, ACCOUNT_RULES.md). It can be run twice safely.
4. In web/:   npx prisma migrate dev        <-- do NOT add --name: the migration already exists in the zip
              npx prisma generate
   (The folder is named 20261109100000 on purpose: the ads patch already used a 20261109 name, and a migration that sorts
   BEFORE an applied one makes "migrate dev" complain. If it still asks to reset the database or says there is drift,
   stop and send me the screen; do not answer yes.)
5. In web/:   npm run test:social-tags   npm run check:i18n   npm run lint   npm run build
6. Manual test (two accounts, A and B):
   a. As A write:  "Hello #Colombo @B and @nobody #කොළඹ"   (use B's real username). On /social the text shows
      #Colombo, @B and #කොළඹ as links; @nobody stays plain text.
   b. Click #Colombo: /social/tag/colombo lists the post. /social/tag/COLOMBO shows the same. /social/tag/123 is "not found".
      /social/tag/zzzunused is an empty page with a message. Logged out: only the log-in message.
   c. As B: the bell shows 1; /notifications says "A mentioned you in a post" and leads to the post.
   d. As A edit the post: keep @B -> B gets NO second notification. Remove @B (while B has not read it) -> B's notification is
      gone. Add @B again -> still no new notification (one per person per post, ever).
   e. Write a post with 11 different hashtags: the first 10 are links, the 11th is plain text.
   f. Hide a post with a hashtag in /admin/social: it leaves /social/tag/<tag>; restore it: it comes back.
   g. Delete your own post: it leaves /social/tag/<tag>.
   h. A hashtag inside a web address (https://example.com/page#section) and an e-mail address (me@example.com) are plain text.
7. Tick SOCIAL_TODO 6 when everything passes.

Not in this patch on purpose: hashtags and mentions in replies and in quote-repost text (plain text there), a hint under the
post box, trending hashtags (B7), search (B1), Block / Mute rules for mentions (Block does not exist yet: when it does, a
blocked person must not be able to mention the blocker), pictures (next patch, 4b).
