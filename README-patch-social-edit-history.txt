patch-social-edit-history  (SOCIAL_TODO item 6: edit window + edit history for Social posts)   PROVISIONAL numbers

What it does (the usual way, like X / Twitter):
 - EDIT WINDOW: a Social post can be edited for 60 minutes after it was written, at most 5 times. An edit does NOT restart the time.
   After that the Edit button is replaced by a short sentence, and the server refuses the edit anyway.
 - EDIT HISTORY: every edit saves the text it replaced. The "Edited" label under a post is now a link to /social/<number>/history,
   which shows the current text and every earlier version (with the time each was written), newest first.
   Everybody who can see the post can open it (same rules as the post page: a hidden, removed, deleted or blocked-person post is "not found").
 - Deleting your own post, and the final erasure of an account, also erase the earlier versions. "Download my data" includes them.
 - The numbers are in web/src/config/site.ts: `socialEdit` (windowMinutes: 60, maxEdits: 5). Change them there if you want.
 - IMPORTANT, a change of behaviour: posts older than 60 minutes can no longer be edited, from the moment this patch is on.
 - Posts that were edited BEFORE this patch have no saved earlier versions; their history page says so.
 - DATABASE CHANGE: one new table (SocialPostEdit), new migration social_post_edits.
 - 11 new texts in six languages.

1. Back up the project folder first (a copy of it is enough).
2. In the project folder (where PROJECT.md is):
     unzip -o patch-social-edit-history.zip
     node apply-social-edit-history.mjs
3. In web/:
     npx prisma migrate dev
     npx prisma generate
     npm run test:social-edit
     npm run lint
     npm run build
   (If npm run dev is running, stop it and start it again after "prisma generate".)
   Also worth running again: npm run test:purge-social   npm run test:export-social   (they use the local database and change nothing)
4. Manual test (npm run dev, log in, /social):
   a. Write a post, press Edit: the form says "5 of 5 edits left". Change the text and save.
   b. Under the post "Edited" is now a link. Open it: the current text on top (marked), the first text below it.
   c. Edit it 4 more times (rate limit is 20 per 10 minutes, so this is fine): after the 5th edit the Edit button is gone and a sentence says
      all edits are used. The history page shows 5 earlier versions.
   d. Time window: write a new post, then in `npx prisma studio` move its createdAt back by 2 hours. Reload: no Edit button, a sentence about the time.
      (If you had the page open already, press Save: you get the same sentence instead of an error.)
   e. Log in as another person and open /social/<number>/history of a post that was edited: it opens. Hide or delete the post: it is "not found".
   f. Delete an edited post of your own. In prisma studio the SocialPostEdit rows of that post are gone.
   g. Light and dark theme, and the phone size: the history page and the underlined "Edited" label look right.
