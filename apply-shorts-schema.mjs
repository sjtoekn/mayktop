// Adds the Shorts models to web/prisma/schema.prisma (safe to run twice). Run from the project root (the folder with web/):
//   node apply-shorts-schema.mjs
// then, inside web/:   npx prisma migrate deploy   (or: npx prisma migrate dev)   and   npx prisma generate
import fs from "node:fs";

const file = "web/prisma/schema.prisma";
let s = fs.readFileSync(file, "utf8");
if (s.includes("model Short {")) {
  console.log("schema.prisma already has the Shorts models - nothing changed.");
  process.exit(0);
}

const userAnchor = "  photoCollections PhotoCollection[]\n";
if (!s.includes(userAnchor) || !s.includes("model User {")) {
  console.error("Could not find the User model anchor (photoCollections). Add the 4 relation lines by hand - see README.");
  process.exit(1);
}
s = s.replace(
  userAnchor,
  userAnchor +
    "  shorts         Short[]\n" +
    "  shortLikes     ShortLike[]\n" +
    "  shortBookmarks ShortBookmark[]\n" +
    "  shortComments  ShortComment[]\n",
);

s += `
// ---------------------------------------------------------------- Shorts (SHORTS_TODO 7-10)
// Short vertical videos (route /shorts). Limits live in src/config/short-config.ts. Files: src/lib/short-file.ts.
enum ShortPrivacy {
  PUBLIC
  UNLISTED
  PRIVATE
}

// Where the upload is: PROCESSING -> READY (or FAILED). Separate from \`status\` (moderation: VISIBLE / HIDDEN_PENDING_REVIEW / REMOVED).
enum ShortProcessing {
  PROCESSING
  READY
  FAILED
}

model Short {
  id          Int             @id @default(autoincrement())
  ownerId     String
  file        String          @unique // "<32 hex>.mp4"; the thumbnail is "<32 hex>-t.webp"
  title       String?
  description String?
  privacy     ShortPrivacy    @default(PUBLIC)
  processing  ShortProcessing @default(PROCESSING)
  processingNote String? // why it FAILED (shown to the owner)
  durationMs  Int?
  sizeBytes   Int
  width       Int?
  height      Int?
  status      ContentStatus   @default(VISIBLE)
  statusSiteRule  String?
  statusNote      String?
  statusChangedAt DateTime?
  viewCount   Int             @default(0) // a bare running total, nothing about who looked is saved
  sharedSocialPostId Int? // set when the owner shared it to the Social feed (SocialPost.id; a plain number, no relation)
  readyAt     DateTime?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  editedAt    DateTime?
  deletedAt   DateTime?

  owner     User            @relation(fields: [ownerId], references: [id], onDelete: Restrict)
  likes     ShortLike[]
  bookmarks ShortBookmark[]
  comments  ShortComment[]

  @@index([createdAt, id])
  @@index([ownerId, createdAt])
  @@index([processing, privacy, status, createdAt])
}

model ShortLike {
  userId    String
  shortId   Int
  createdAt DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Restrict)
  short Short @relation(fields: [shortId], references: [id], onDelete: Restrict)

  @@id([userId, shortId])
  @@index([shortId])
}

model ShortBookmark {
  userId    String
  shortId   Int
  createdAt DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Restrict)
  short Short @relation(fields: [shortId], references: [id], onDelete: Restrict)

  @@id([userId, shortId])
  @@index([shortId])
}

model ShortComment {
  id        Int           @id @default(autoincrement())
  shortId   Int
  authorId  String
  parentId  Int? // a reply to another comment (one level)
  body      String
  status    ContentStatus @default(VISIBLE)
  statusSiteRule  String?
  statusNote      String?
  statusChangedAt DateTime?
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  deletedAt DateTime?

  short   Short          @relation(fields: [shortId], references: [id], onDelete: Restrict)
  author  User           @relation(fields: [authorId], references: [id], onDelete: Restrict)
  parent  ShortComment?  @relation("ShortCommentReplies", fields: [parentId], references: [id], onDelete: Restrict)
  replies ShortComment[] @relation("ShortCommentReplies")

  @@index([shortId, createdAt])
  @@index([authorId, createdAt])
  @@index([parentId])
}
`;
fs.writeFileSync(file, s);
console.log("Done: Shorts models added to schema.prisma.");
