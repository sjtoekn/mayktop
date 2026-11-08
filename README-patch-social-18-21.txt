patch-social-18-21  (SOCIAL_TODO 18 Replies + 21 Notifications page)

What it does:
 - REPLIES: under every Social post (its own page /social/<id>) there is a reply box and the list of replies (oldest first,
   up to 1,000 characters). You can delete your own reply. Every Social post card shows the reply count as a link.
 - NOTIFICATIONS: new page /notifications (follow, like, repost, reply; newest first; unread marked; "Mark all as read").
   The bell in the left menu is now a real link with the unread number.
 - Account erasure now erases a person's reply texts, and "Download my data" includes their replies.
This patch needs a DATABASE CHANGE (one new table).

Install patch-social-27 and patch-social-17 first (check:i18n reports 8 problems about social.tabs.* / social.following.*
until patch-social-17 is applied: that is not this patch).

1. Make a backup zip of the project (also copy web/dev.db to web/dev.db.before-social-18-21).
2. In the project folder (where PROJECT.md is):   unzip -o patch-social-18-21.zip
   NEW files:  web/src/lib/social-reply.ts, social-replies-query.ts, social-notifications.ts
               web/src/app/(site)/social/reply/actions.ts
               web/src/app/(site)/notifications/page.tsx, actions.ts, notifications.css, count/route.ts
               web/src/components/social/SocialReplyForm.tsx, SocialReplyList.tsx, SocialReplyDelete.tsx
               web/src/components/shell/NotificationBadge.tsx
               web/scripts/test-social-reply.ts
               apply-social-18-21.mjs, i18n-social-18-21/ (6 small text files)
3. node apply-social-18-21.mjs      (must end with "All done.")
   It edits 16 existing files (schema.prisma, site.ts, package.json, queries.ts, purge-social.ts, export-social.ts,
   Shell.tsx, Sidebar.tsx, SocialPostCard.tsx, social/[id]/page.tsx, the 6 language files, test-purge-social.ts,
   CHANGELOG.md, ACCOUNT_RULES.md). It can be run twice safely.
4. cd web
   ./node_modules/.bin/prisma migrate dev --name social_replies
   (only a new table; if it asks to RESET the database, say NO and send me the message)
   ./node_modules/.bin/prisma generate
5. In web/:  npm run test:social-reply   npm run test:purge-social   npm run test:export-social
             npm run test:social-review   npm run check:i18n   npm run lint   npm run build
6. Manual test (2 people: "ann" and "bob", both logged in, in two browsers or a normal and a private window):
   a. ann writes a Social post. bob opens it (/social/<number>): the "Replies (0)" box is there. bob writes a reply -> it shows.
   b. The post card in the feed shows 💬 1. Clicking it opens the post at the replies.
   c. ann: the bell in the left menu shows 1. Open /notifications: "bob replied to your post", marked New. Click it -> the post.
      "Mark all as read" -> the New marks and the red number disappear.
   d. bob replies 3 more times quickly: ann still has only ONE new line (one unread notification per person per post).
   e. bob deletes his own reply (Delete -> Yes): the text is gone. ann has no Delete button under bob's reply.
   f. ann replies to her own post: no notification for anybody.
   g. Hide ann's post with /admin/social (patch-social-27): bob's notification line about it disappears from ann's list.
7. Tick SOCIAL_TODO 18 and 21 when everything passes.

Not in this patch on purpose (next steps): replies to replies, hiding / removing / reporting a REPLY (the status column is ready),
a notification marked read by opening it (only "Mark all as read"), notifications about community posts and comments.
