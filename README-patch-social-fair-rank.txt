patch-social-fair-rank  (SOCIAL_TODO B10: fair ranking of replies and reposts)   rules: ACCOUNT_RULES.md 3.22, PROJECT.md 8e-2, PROVISIONAL

What it does:
 - LIKE ON A REPLY. Every reply gets a heart button and a number. No notification is made. Needs a visible reply on a visible post; blocks are respected.
 - "TOP" ORDER FOR REPLIES. On /social/<id> (when there are 2 or more replies) the reader can choose "Oldest" (default, as before) or "Top".
   "Top" is the SAME fair engine as the Popular page (PROJECT.md 8e): likes count with limits and fade with age, one account cannot fill
   the list, and every 4th place is reserved for a new voice (small "New voice" label that links to /fairness).
   Nothing is hidden by ranking. Replies hidden by the post's author stay in "Hidden replies".
 - FEEDS. Inside one feed page (Social, Following, Home) several PLAIN reposts of the same post become one line:
   "<name> and 3 more reposted". A quote repost is never merged. Nothing is deleted.
 - NOT changed on purpose: the "Quotes" list (a quote has no like, so there is nothing to rank by: it stays newest first) and the feed itself (newest first).
 - DATABASE CHANGE: 1 new table SocialReplyLike. The migration is in the zip.

1. Back up the project and web/dev.db:     cp web/dev.db web/dev.db.before-fair-rank
2. In the project folder (where PROJECT.md is):   unzip -o patch-social-fair-rank.zip
                                                   node apply-social-fair-rank.mjs     <-- must end with "All edits done"
3. In web/:   npx prisma migrate dev        <-- do NOT add --name (the migration is in the zip)
              npx prisma generate
   (If it asks to reset the database or says there is drift, stop and do not answer yes.)
4. In web/:   npm run test:social-fair-rank   npm run test:social-reply-control   npm run check:i18n   npm run lint   npm run build
5. Manual test (accounts A, B, C; A writes a post; B and C reply):
   a. Under each reply a heart with 0. As B press the heart on C's reply: 1, filled. Reload: still filled. Press again: back to 0.
   b. With 2 or more replies a bar "Oldest | Top | How replies are ranked" appears. "Oldest" = by time. "Top": the reply with more likes comes first.
   c. Let one account write 5 replies and give them likes: in "Top" another account's reply is not pushed to the very end.
   d. A brand new account's reply (age under 30 days) can show the "New voice" label in "Top" only, never in "Oldest".
   e. Wrong address like /social/<id>?sort=zzz shows "Oldest" (no error).
   f. As A hide one reply (Reply control): it stays in "Hidden replies" in both orders.
   g. B reposts one post, then C reposts the same post (no quote): in /social one line "C and 1 more reposted" (or "B and 1 more...") with ONE card.
      A quote repost of the same post stays its own card.
   h. "Download my data" (Settings): "replyLikes" lists the reply numbers you liked.
