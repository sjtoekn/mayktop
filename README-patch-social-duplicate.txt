patch-social-duplicate  (SOCIAL_TODO C2, part 3: the same text sent again and again)   PROVISIONAL numbers

Needs patch-rate-limit-db.zip and patch-new-account-limits.zip applied FIRST (in that order).

What it does:
 - A new post or a new reply is refused when the SAME person already sent the same text in the last 24 hours.
   "Same" ignores capital letters, spaces, line breaks, punctuation and emoji ("Buy NOW!!" = "buy now").
 - Short texts (under 12 letters/numbers, for example "thanks") are never counted as repeats.
 - Replies are compared across all posts (the same reply under many posts is the usual spam pattern).
 - The person sees: "You already posted this text recently. Please write something new." (six languages)
 - Numbers are in web/src/config/site.ts: `socialDuplicate` (windowHours: 24, minChars: 12).
 - NO DATABASE CHANGE (no migration, no prisma commands).

1. Back up the project folder first (a copy of it is enough).
2. In the project folder (where PROJECT.md is):   unzip -o patch-social-duplicate.zip
3. In web/:   npm run test:social-duplicate   npm run check:i18n   npm run lint   npm run build
4. Manual test (use an account older than 7 days, or the limits of a new account may stop you first):
   a. Write a post "Hello everyone, this is my test post". Write exactly the same again: refused with the "already posted" message.
   b. Write it again as "HELLO EVERYONE!!! this is my   test post": also refused.
   c. Change one word: it is accepted.
   d. Write the short post "thanks" twice: both accepted.
   e. Reply "I agree with you completely" under one post, then the same reply under ANOTHER post: refused.
   f. Delete your first post, then write the same text again: accepted (a deleted post keeps no text).
