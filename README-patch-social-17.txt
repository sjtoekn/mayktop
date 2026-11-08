patch-social-17  (SOCIAL_TODO 17: Following feed)

1. Make a backup zip of the project first.
2. Copy the folders of this patch over your project (same paths; "web/" and apply-social-17.mjs next to PROJECT.md).
   This REPLACES 2 files and adds 7:
     replaced: web/src/lib/queries.ts, web/src/app/(site)/social/page.tsx
     new:      web/src/lib/social-following.ts, web/src/components/social/SocialFeedTabs.tsx,
               web/src/components/social/SocialFeedList.tsx, web/src/app/(site)/social/following/page.tsx,
               web/scripts/test-social-following.ts, apply-social-17.mjs
3. In the project folder: node apply-social-17.mjs   (must end with "All done.")
4. In web/: npm run test:social-following   npm run lint   npm run build
   No database change.
5. Manual test: see the note on item 17 in SOCIAL_TODO.md.
