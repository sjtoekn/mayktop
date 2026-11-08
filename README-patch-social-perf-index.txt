patch-social-perf-index (SOCIAL_TODO C3 Performance, part 1: indexes)

Adds 4 indexes, nothing else (no code change, no data change):
  SocialRepost  (createdAt, id)          -> /social and Home feed order
  Notification  (recipientId, createdAt) -> notification list order
  SocialPostTag (createdAt)              -> trending hashtags scan
  Post          (createdAt, id)          -> Home feed across all communities

Files:
  web/prisma/schema.prisma   (4 @@index lines, marked patch-social-perf-index)
  web/prisma/migrations/20261119090000_social_perf_index/migration.sql

Install (from the project folder, web/):
  1. Copy the two paths over your project (back up schema.prisma first if you changed it after 7-mayktop.zip;
     otherwise just add the 4 @@index lines yourself).
  2. npx prisma migrate deploy        (or: npx prisma migrate dev)
  3. npx prisma generate
  4. npm run lint && npm run build

Rollback: DROP INDEX the 4 names above and delete the migration folder.
Not done yet: splitting the "social-posts" cache tag (likes/reposts/replies currently flush every feed).
