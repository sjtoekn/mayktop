patch-social-discover  (SOCIAL_TODO B7: Who to follow + Trending hashtags)   rules: ACCOUNT_RULES.md 3.19, PROVISIONAL

What it does:
 - A "Discover" card on the first page of /social and /social/following (logged-in people only), above the posts.
 - Trending hashtags: tags used by at least 2 DIFFERENT people in the last 48 hours; most people first; top 5. A tag whose posts are
   hidden or removed leaves the list. Shared, cached a few minutes.
 - Who to follow: recently active people you do not follow yet (not blocked / muted / suspended), people followed by those you
   follow first, then a daily shuffle. NOT ranked by follower count. Top 5 with a Follow button.
 - NO DATABASE CHANGE. Nothing new is stored.
 - Needs patch-social-pin.zip applied first (this zip contains the same changes in the shared files: en.ts etc.). If you already did
   that, nothing to worry about.

1. Back up the project.
2. In the project folder (where PROJECT.md is):   unzip -o patch-social-discover.zip
3. In web/:   npm run test:social-discover   npm run check:i18n   npm run lint   npm run build
   (no migration, no prisma generate needed)
4. Manual test (use 3-4 accounts; A, B, C, D):
   a. Make B and C each write a post with #colombo. As A open /social: "Trending hashtags" shows #colombo "2 people". Click it: the tag page.
   b. D writes 5 posts with #spam: #spam is NOT in Trending (one person).
   c. As A: "Who to follow" shows B, C, D (not yourself). Click Follow on B: it becomes "Following" (reload: B is gone from the list).
   d. A follows B, B follows C: for A, C shows "Followed by 1 person you follow" and is listed first.
   e. A blocks D (or mutes D): D leaves the list. Unblock: D can come back.
   f. Admin hides B's and C's #colombo posts: #colombo leaves Trending (within a few minutes, the cache).
   g. Reload the page several times the same day: the order of the list does not change.
   h. On /social page 2 ("Older"): no Discover card.
   i. A brand-new site with no hashtags and no other people: no card at all (not an empty box).

Not in this patch on purpose: "show more" page, Dismiss on a suggestion, staff list of tags hidden from Trending, suggestions by interests.
