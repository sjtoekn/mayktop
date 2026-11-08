patch-rate-limit-db  (SOCIAL_TODO C2, part 1: rate limits move from server memory to the database)

What it does:
 - Every Social rate limit (likes, follows, reposts, bookmarks, pins, blocks, reports, edits, deletes, search, "new posts" banner,
   views, picture checks, reply hide, reply likes, notification settings) is now counted in the database (new table RateEvent),
   not in the server's memory. A restart no longer clears the counts, and several servers share one count.
 - Same numbers and rules as before. If the database fails for one call, that call uses the old memory counter (the site does not break).
 - DATABASE CHANGE: 1 new table RateEvent. The migration is in the zip.

1. Back up first (in the project folder):   cp web/dev.db web/dev.db.before-rate-limit-db
2. In the project folder (where PROJECT.md is):   unzip -o patch-rate-limit-db.zip
3. In web/:   npx prisma migrate dev        <-- do NOT add --name (the migration is in the zip)
              npx prisma generate
   (If it asks to reset the database or says there is drift, stop and do not answer yes.)
4. In web/:   npm run test:rate-limit-db   npm run test:social-limits   npm run lint   npm run build
5. Manual test:
   a. Log in, press Like / Unlike on a post quickly more than 40 times in a minute: the "too many" message appears (same as before).
   b. Stop the server (Ctrl+C), start it again (npm run dev) right away: the "too many" message is STILL there for the rest of the minute
      (before this patch it was gone after a restart).
   c. Open the database (npx prisma studio) and look at the table RateEvent: rows like "like:<id>" with a time. Old rows disappear by themselves.
   d. Normal use (a few likes, follows, a search) works as before.
