patch-social-profile  (SOCIAL_TODO 2: Profile page)

Install patch-social-pagination FIRST (the Posts tab uses its "Older posts" paging).

What it does:
 - New page /social/u/<username> (logged-in people only, like every Social page):
     header  : first-letter avatar, name, @username, bio, joined month, counts (posts, followers, following), Follow / Unfollow
     tabs    : Posts (posts AND reposts, "Older posts" paging) | Replies | Likes (ONLY on your own profile) | Followers | Following
 - The name on every Social post card and quote is now a link to that person's profile.
 - Replies, Likes, Followers and Following show the newest 100, with a short note when the list is that long.
 - NO database change. NO new setting.

1. Make a backup zip of the project.
2. In the project folder (where PROJECT.md is):   unzip -o patch-social-profile.zip
   NEW files:  web/src/lib/social-profile.ts
               web/src/components/social/SocialProfileTabs.tsx, SocialPeopleList.tsx
               web/src/app/(site)/social/u/[username]/page.tsx
               web/scripts/test-social-profile.ts
               apply-social-profile.mjs, i18n-social-profile/ (6 small text files)
3. node apply-social-profile.mjs      (must end with "All done.")
   It edits 13 existing files (queries.ts, SocialPostCard.tsx, SocialRepostCard.tsx, content.css, package.json,
   the 6 language files, CHANGELOG.md, ACCOUNT_RULES.md). It can be run twice safely.
4. In web/:  npm run test:social-profile   npm run check:i18n   npm run lint   npm run build
5. Manual test (2 people "ann" and "bob", both logged in; two browsers or a normal and a private window):
   a. As bob, click ann's NAME on one of her posts: /social/u/ann opens with her posts, counts and a Follow button.
   b. Follow ann: the button changes; ann's "followers" count is 1 after you reload. Click "1 follower": the Followers tab lists bob.
   c. Replies tab: ann's replies, each "Replying to @..." with the time linking to the post. A reply under a hidden post is not listed.
   d. As bob there is NO Likes tab on ann's profile; /social/u/ann?tab=likes shows her Posts instead.
   e. As ann: your own profile has the Likes tab (with the "Only you can see this tab" line) and says "This is your profile." (no Follow button).
   f. /social/u/nobody_here , /social/u/ab , /social/u/a-b : "not found" (404). As a visitor (logged out): the log-in message.
   g. Hide ann's post with /admin/social: it is gone from her Posts tab and the posts count goes down.
   h. Posts tab with more than 50 items: "Older posts" works (set SOCIAL_FEED_SIZE to 3 in queries.ts for the test only).
6. Tick SOCIAL_TODO 2 when everything passes (avatar and banner pictures wait for SOCIAL_TODO 5).

Not in this patch on purpose: avatar and banner pictures (they need picture upload), editing your bio or display name from
the profile, paging for Replies / Likes / Followers / Following (newest 100 only), private accounts, a pinned post,
a profile for people who are not logged in. The community profile /u/<username> (sample data) is unchanged.
