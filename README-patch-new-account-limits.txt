patch-new-account-limits  (SOCIAL_TODO C2, part 2: stricter limits for new accounts)   PROVISIONAL numbers

Needs patch-rate-limit-db.zip applied FIRST (it must already be in your project).

What it does:
 - An account younger than 7 days gets HALF of each limit for: new posts, replies, follows, likes (posts and replies), reposts, reports.
   Example: posts 5 per 10 min and 30 per day  ->  2 per 10 min and 15 per day.
 - After 7 days the normal numbers apply by themselves. Nothing changes for other actions, and no text changed.
 - The numbers are in web/src/config/site.ts: `newAccountLimits` (days: 7, factor: 0.5). Change them there if you want.
 - NO DATABASE CHANGE (no migration, no prisma commands).

1. Back up the project folder first (a copy of it is enough).
2. In the project folder (where PROJECT.md is):   unzip -o patch-new-account-limits.zip
3. In web/:   npm run test:new-account   npm run test:rate-limit-db   npm run lint   npm run build
4. Manual test:
   a. Register a brand new account and log in. Write posts one after another: the 3rd post within 10 minutes is refused
      with the "try again in N min" message (an older account can still write 5).
   b. To check that an old account is not affected: log in with an account made more than 7 days ago
      (or in web/ run:  npx prisma studio  and move the account's createdAt date back by 8 days). It can write 5 posts in 10 minutes again.
   c. A new account can still like, follow and reply normally, only fewer times per minute.
