patch-social-cache-tags (SOCIAL_TODO C3 Performance, part 2: cache tags). No database change.

Before: every like / reply / reply like flushed ALL Social caches ("social-posts").
After : like -> only that post page; reply -> reply list + that post page; reply delete/hide/like -> reply list.
        New / edited / deleted / hidden posts, reposts, admin decisions still flush the feeds (unchanged).
Cards in the feeds show new like/reply numbers within ~1 minute; the person who clicked sees it at once.

Files (copy over the project, same paths):
  CHANGELOG.md                                   (one line added at the top of 2026-11-08; copy the line if you edited the file)
  web/src/lib/social-cache-tags.ts               (new)
  web/src/lib/queries.ts                         (getSocialPost tag + comment)
  web/src/lib/social-replies-query.ts            (tag "social-replies")
  web/src/app/(site)/social/like/actions.ts
  web/src/app/(site)/social/reply/actions.ts
  web/src/app/(site)/social/reply-like/actions.ts

Check (inside web/):  npm run lint && npm run build
Manual: like a post, open its page -> new number at once; like in /social -> card number updates within ~1 min on reload;
        reply under a post -> the reply shows at once; hide / delete a reply -> list changes at once.
Rollback: restore the 6 files (and the CHANGELOG line) from your backup.
