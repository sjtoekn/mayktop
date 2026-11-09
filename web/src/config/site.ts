// The site name. To rename, change it here only.
// The name is shown in two colours in the logo: nameStart (normal) + nameAccent (brand colour).
// Site description and all other visible text live in src/i18n/messages/.
const nameStart = "Mayk";
const nameAccent = "Top";

export const siteConfig = {
  name: nameStart + nameAccent,
  nameStart,
  nameAccent,
};

// Ads (TODO 44). Flat monthly fee: no price per click or per impression. Change numbers here only.
export const adsConfig = {
  monthlyPriceCents: 1000, // one slot for one month = $10.00
  periodDays: 30, // an ad runs this many days from the moment an admin marks it as paid (the flat fee covers one such period)
  endingSoonDays: 3, // the "your ad ends soon" email goes out once, when the end date is at most this many days away (Session 4c)
  currency: "USD",
  // Must match the AdSlotType enum in prisma/schema.prisma.
  slots: ["SIDEBAR", "FEED", "SOCIAL_FEED", "HEADER"] as const,
  // Rotation (Session 2). There is NO limit on how many ads can run: all active ads share the slots fairly.
  rotation: {
    noRepeatMinutes: 60, // the same browser is not shown the same ad again within this time
    poolSize: 12, // the server sends this many candidate ads per slot; the browser picks one it has not shown lately
    windowDays: 7, // "fair share" is measured over the last N days (ads with the fewest impressions go first)
  },
  // Counting limits per ad per minute. They stop one script from inflating an ad's numbers. No visitor is
  // identified (the limit is per ad, not per person). In-memory per server process; a shared limiter is TODO 50.
  counting: {
    maxImpressionsPerAdPerMinute: 600,
    maxClicksPerAdPerMinute: 60,
  },
  // Length limits for the submit form (Session 3).
  titleMaxLength: 60,
  bodyMaxLength: 140,
  titleMinLength: 3,
  bodyMinLength: 10,
  urlMaxLength: 2000, // the https link of an ad
  // Ad formats (decision 10). One ad has exactly one format; every format costs the same flat fee. Must match the AdFormat
  // enum in prisma/schema.prisma. `formatsOpen` = the formats that can be SENT today (Session 3b adds IMAGE and VIDEO here).
  formats: ["TEXT", "IMAGE", "VIDEO"] as const,
  formatsOpen: ["TEXT", "IMAGE", "VIDEO"] as const, // all three are open since Session 3b
  // Media limits (decision 10, PROVISIONAL). Files are kept in OUR storage, never as an advertiser-hosted address (Session 3b).
  media: {
    // A picture, or the poster of a video ad. Two numbers: the advertiser may SEND up to imageUploadMaxBytes (phone photos are
    // big); our server then makes it smaller (src/lib/ad-image.ts) so the SAVED file is at most imageMaxBytes.
    imageUploadMaxBytes: 25 * 1024 * 1024,
    imageMaxBytes: 5 * 1024 * 1024,
    // A video ad is sent WITHOUT a poster. The advertiser may send a longer video: only the first `videoSeconds` seconds are ever
    // shown (the server cuts it with ffmpeg when it is installed, src/lib/ad-video.ts, and the player itself stops at that second
    // and starts again, components/AdVideo.tsx). The video is silent and starts by itself (changed 2026-11-08, ADS_PLAN decision 10b).
    // The form sends only the video for a video ad, so it fits in the 60 MB form limit of next.config.ts.
    videoMaxBytes: 50 * 1024 * 1024,
    videoSeconds: 10,
    imageTypes: ["image/jpeg", "image/png", "image/webp"] as const,
    videoTypes: ["video/mp4", "video/webm"] as const,
  },
  // Limits on sending ads (counted from the database, per person).
  submit: {
    maxWaiting: 5, // ads waiting for review at the same time
    maxPerDay: 10, // ads created in the last 24 hours
    maxStartDaysAhead: 90, // the earliest start date may be at most this many days from today
  },
  // A FIRST, basic filter on the wording of an ad (lower case; spaces do not matter). It only catches the clearest scam
  // phrases: an admin still reads every ad. English only for now; add phrases here.
  blockedPhrases: [
    "guaranteed returns",
    "get rich quick",
    "risk-free profit",
    "double your money",
    "you have won",
    "you've won",
    "claim your prize",
    "verify your account",
    "your account has been suspended",
    "free money",
    "miracle cure",
    "100% guaranteed",
  ] as readonly string[],
  // Ad policy rules. A rejection must name one of these keys + a written reason (like community rules
  // for removed posts). Visible texts for each key go in src/i18n/messages/ (Session 5).
  policyRules: [
    "MISLEADING", // false or misleading claims
    "LOOKS_LIKE_POST", // pretends to be a post / comment / system message
    "HARMFUL_PRODUCT", // illegal, dangerous or deceptive product or service
    "UNSAFE_LINK", // link is not https, redirects, or leads to malware / scam
    "HATE_OR_ADULT", // hateful or adult content
    "TRACKING", // asks for personal data without need, or hides trackers
    "TECHNICAL", // wrong size, unreadable, broken link
  ] as const,
};

// Account lifecycle (TODO 36). PROVISIONAL numbers, to be confirmed by a lawyer (PROJECT.md 8c).
export const accountConfig = {
  deletionGraceDays: 7, // days a self-deleted account waits (and can be recovered by logging in) before erasure
  deletePasswordMaxFailures: 5, // wrong passwords allowed in the window below before the delete form is locked
  deletePasswordWindowMinutes: 15,
};

// Profile and sign-in security settings (patch-profile-security, PROVISIONAL numbers: change them here only).
//  - displayName / bio: the limits are counted in characters a person sees (an emoji is one).
//  - profileEdit: how often one person may save the profile; passwordChange / emailChange: how often one person may try
//    (every attempt counts, right or wrong, so a stolen login cannot guess the password).
export const profileConfig = {
  displayNameMax: 50,
  bioMax: 300,
  profileEdit: [{ max: 10, windowSeconds: 60 * 60 }],
  passwordChange: [{ max: 5, windowSeconds: 15 * 60 }],
  emailChange: [{ max: 3, windowSeconds: 60 * 60 }],
};

// Limits on Social actions (SOCIAL_TODO 10, PROVISIONAL: change the numbers here only).
//  posts: every rule must have room. Counted from the person's earlier posts in the database
//         (hidden and deleted posts count too). Example: at most 5 posts in 10 minutes AND at most 30 in 24 hours.
//  likes: like + unlike actions per person, counted in server memory.
//  edits: edits of one's own posts per person, counted in server memory.
// A shared limiter for many servers, and limits for everything else, are TODO 50.
// Stricter limits for NEW accounts (SOCIAL_TODO C2, part 2). PROVISIONAL numbers: tune after real use.
// An account younger than `days` gets `factor` of every limit below (rounded down, never less than 1):
// posts, replies, follows, likes (posts and replies), reposts and reports. Spam accounts are almost always brand new.
// Nothing else changes for them. After `days` days the normal numbers apply, with no action from anybody.
export const newAccountLimits = {
  days: 7,
  factor: 0.5,
};

// The same text sent again and again (SOCIAL_TODO C2, part 3). PROVISIONAL numbers: tune after real use.
// A new post or reply is refused when the SAME person already sent the same text within `windowHours`.
// "Same" ignores capital letters, spaces, line breaks, punctuation and emoji ("Buy now!!" = "buy  now").
// Texts shorter than `minChars` (after that cleaning) are never counted as repeats, so "thanks" or "+1" can be said twice.
export const socialDuplicate = {
  windowHours: 24,
  minChars: 12,
};

// Editing your own Social post (SOCIAL_TODO item 6). PROVISIONAL numbers: tune after real use. The usual way (X / Twitter):
// a post can be edited for `windowMinutes` after it was WRITTEN (an edit does not restart the time), at most `maxEdits` times.
// Every earlier version is kept and shown on /social/<id>/history to everybody who can see the post.
export const socialEdit = {
  windowMinutes: 60,
  maxEdits: 5,
};

export const socialLimits = {
  posts: [
    { max: 5, windowMinutes: 10 },
    { max: 30, windowMinutes: 24 * 60 },
  ],
  likes: { max: 40, windowSeconds: 60 },
  blocks: [
    { max: 30, windowSeconds: 60 },
    { max: 300, windowSeconds: 24 * 60 * 60 },
  ], // block / unblock / mute / unmute together (SOCIAL_TODO A7), counted in server memory
  bookmarks: [
    { max: 60, windowSeconds: 60 },
    { max: 600, windowSeconds: 24 * 60 * 60 },
  ], // save / remove a bookmark (SOCIAL_TODO B2), counted in server memory
  pins: [
    { max: 20, windowSeconds: 60 },
    { max: 200, windowSeconds: 24 * 60 * 60 },
  ], // pin / unpin your own post (SOCIAL_TODO B6), counted in server memory
  // Trending hashtags and Who to follow (SOCIAL_TODO B7). Provisional numbers, ACCOUNT_RULES.md 3.19.
  discover: {
    trendingWindowHours: 48, // a hashtag trends from posts made in this window
    trendingMinPeople: 2, // at least this many DIFFERENT people must have used it (one person repeating a tag never trends)
    trendingSize: 5,
    trendingScanLimit: 3000, // at most this many tag rows are read per refresh
    suggestSize: 5,
    suggestActiveDays: 30, // only people who posted (visible) in this window are suggested
    suggestPool: 300, // how many recently active people are looked at
  },
  notificationSettings: [
    { max: 20, windowSeconds: 60 },
    { max: 200, windowSeconds: 24 * 60 * 60 },
  ], // saving the notification settings (SOCIAL_TODO B8), counted in server memory
  maxBookmarks: 2000, // bookmarks one person may keep; when full, saving another is refused (removing always works)
  deletes: { max: 20, windowMinutes: 10 }, // deleting one's own Social posts (SOCIAL_TODO 13), counted in server memory
  edits: { max: 20, windowMinutes: 10 }, // edits of one's own Social posts (SOCIAL_TODO 12), counted in server memory
  follows: [
    { max: 30, windowSeconds: 60 },
    { max: 500, windowSeconds: 24 * 60 * 60 },
  ], // follow / unfollow (SOCIAL_TODO 15), counted in server memory
  reposts: [
    { max: 30, windowSeconds: 60 },
    { max: 300, windowSeconds: 24 * 60 * 60 },
  ], // repost / quote / undo (SOCIAL_TODO 16), counted in server memory
  searches: [
    { max: 30, windowSeconds: 60 },
    { max: 600, windowSeconds: 24 * 60 * 60 },
  ], // Social search (SOCIAL_TODO B1), every search page opened counts, server memory (shared limiter: TODO 50)
  newPosts: [
    { max: 12, windowSeconds: 60 },
    { max: 2000, windowSeconds: 24 * 60 * 60 },
  ], // the "n new posts" banner asks about once a minute per open tab (SOCIAL_TODO B4), server memory
  views: [
    { max: 120, windowSeconds: 60 },
    { max: 5000, windowSeconds: 24 * 60 * 60 },
  ], // views reported by the browser (SOCIAL_TODO B5): scrolling past 50 posts must fit; a script must not; server memory
};

// The picture of a Social post (patch-social-images, PROJECT.md 8j.5). PROVISIONAL: confirm the numbers.
// ONE picture per post; the real content must be a JPEG, PNG or WebP (src/lib/social-image.ts). The file is rebuilt
// without Exif / location data and kept in OUR storage folder (web/storage/social/, or SOCIAL_MEDIA_DIR).
//  imageMaxBytes: size of the uploaded file.   maxSide / maxPixels: a small file can be a huge picture that uses
//  gigabytes of memory in other people's browsers, so the size in pixels is limited too.
//  checks: how many pictures one person may send to be checked per time window (server memory), because checking is work.
export const socialMedia = {
  imageMaxBytes: 5 * 1024 * 1024,
  maxSide: 10_000,
  maxPixels: 40_000_000,
  imageTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  checks: { max: 20, windowMinutes: 10 },
};

// Photos (PHOTO_TODO 2-3). Owner decision 2026-11-08 (PHOTO_TODO 1b): up to 50 MB a photo (raised from 20 MB, 2026-11-08). The pixel limit is PROVISIONAL:
// 100 million pixels (the same as the ad pictures) so a 50-60 megapixel camera photo is not refused; the server action body
// limit in next.config.ts (60 MB) is already above 50 MB.
// Anybody may SEE a photo that may be shown, a login is needed to upload / like / report (decided 2026-11-08).
// Every stored photo is a REBUILT WebP copy (no Exif / location): a full copy (longest side at most fullSide) and a small thumbnail.
export const photoMedia = {
  imageMaxBytes: 50 * 1024 * 1024,
  maxSide: 20_000,
  maxPixels: 100_000_000,
  fullSide: 2560,
  fullQuality: 82,
  thumbSide: 480,
  thumbQuality: 72,
  pageSize: 30,
  // How many pictures one person may send to be checked per window. One check = one photo, so this must be well above
  // `batchMax` or a second batch inside the window would be refused (raised from 20 for multiple upload, 2026-11-09).
  checks: { max: 40, windowMinutes: 10 },
  // How many photos one upload form takes at once (multiple upload, stage 1). The photos are sent ONE BY ONE, so a bad
  // photo never spoils the others and the 60 MB server action limit is per photo. Change this number to change the limit.
  batchMax: 10,
};

// What a person types when uploading a photo (PHOTO_TODO 4). PROVISIONAL numbers. The TITLE is required (it is also the
// picture's text description, "alt"); the caption and the tags are optional. Tags follow the Social hashtag rules.
export const photoText = {
  titleMax: 100,
  captionMax: 2000,
  maxTags: 10,
};

// Photo categories (PHOTO_TODO 9). Owner decision 2026-11-08: a short list with only the necessary categories, chosen by
// Claude; one category per photo, chosen when uploading (required; "other" exists so no photo is stuck). The keys are stored
// in Photo.category; the visible names are `photo.category.<key>` in src/i18n/messages/. To add or remove one later: change
// this list, the 6 language files and the tests (a stored key that is no longer here is simply shown as "other").
export const photoCategories = [
  "nature",
  "people",
  "animals",
  "food",
  "travel",
  "buildings",
  "vehicles",
  "art",
  "sports",
  "other",
] as const;
export type PhotoCategory = (typeof photoCategories)[number];

// How many photos one person may upload (PHOTO_TODO 4). PROVISIONAL. Counted from the person's earlier photos in the
// database (deleted ones count too), and stricter while the account is new (limitsFor, newAccountLimits).
export const photoLimits = {
  // Raised for multiple upload (was 5 per 10 minutes and 30 per day): one batch of photoMedia.batchMax photos must fit.
  // A new account gets half of these (newAccountLimits), so 10 per 10 minutes and 50 per day.
  uploads: [
    { max: 20, windowMinutes: 10 },
    { max: 100, windowMinutes: 24 * 60 },
  ],
};

// Places (Photos plan, stage 3): real-world places that photos can be linked to. PROVISIONAL numbers.
// `placeTypes` are the stored keys (Place.type); the visible names are in src/lib/place-text.ts. A stored key that is no longer
// here is shown as "other". Name, city, region and country are one line each; the description may have several lines.
export const placeTypes = [
  "heritage",
  "attraction",
  "nature",
  "beach",
  "park",
  "hotel",
  "restaurant",
  "shop",
  "museum",
  "education",
  "transport",
  "other",
] as const;
export type PlaceType = (typeof placeTypes)[number];

export const placeFields = {
  nameMax: 120,
  cityMax: 80,
  regionMax: 80,
  countryMax: 80,
  descriptionMax: 2000,
  websiteMax: 300,
  pageSize: 30,
};

// How many places one person may add. Counted from the person's earlier places in the database (removed ones count too) and
// stricter while the account is new (limitsFor, newAccountLimits).
export const placeLimits = {
  creates: [
    { max: 5, windowMinutes: 10 },
    { max: 30, windowMinutes: 24 * 60 },
  ],
};

// Staff actions on a person's account (TODO 36d, PROJECT.md 8d). PROVISIONAL: confirm with a lawyer.
// Site-wide rules: short and plain, like community rules. Every suspension or ban must name one of
// these keys AND give a written reason. `serious: true` = a ban is allowed for a first offence;
// for the others a ban is allowed only after an earlier suspension (see staff.ts).
// Visible text for each key: `siteRule.<KEY>` in src/i18n/messages/.
export const staffConfig = {
  siteRules: [
    { key: "HARASSMENT", serious: true },
    { key: "HATE", serious: true },
    { key: "ILLEGAL", serious: true },
    { key: "SPAM", serious: false },
    { key: "ABUSE", serious: false },
    { key: "PRIVACY", serious: true }, // sharing personal details without permission (decided 2026-11-07, PROJECT.md 8j)
    { key: "IMPERSONATION", serious: false }, // pretending to be someone else to deceive
  ] as const,
  maxSuspensionDays: 30, // a temporary suspension is 1..30 days
  banProposalDays: 7, // a ban proposal lapses if no second admin decides within this many days
  banGraceDays: 7, // after a ban: days to download data and appeal before the account is erased
  repeatWindowDays: 365, // "earlier suspension" for the ban ladder means within this many days
  minReasonLength: 20, // a written reason must be at least this long (no one-word decisions)
  maxReasonLength: 1000,
  maxDisplayNameLength: 50, // an admin can edit a person's display name (admin-edit.ts): at most this many characters
  maxBioLength: 300, // ... and bio
  minAppealLength: 20,
  maxAppealLength: 2000,
};
export type SiteRuleKey = (typeof staffConfig.siteRules)[number]["key"];

// Hidden pending review (TODO 38, PROJECT.md 8f). PROVISIONAL numbers.
// The written-reason length is the same as for staff actions: staffConfig.minReasonLength / maxReasonLength.
export const reviewConfig = {
  dueDays: 7, // a hidden post / comment that waits longer than this for the second person is flagged OVERDUE in the pending list
  excerptLength: 80, // how many characters of the post title / comment text go into the email to the author
};

// Appeals (TODO 40, PROJECT.md 8g). PROVISIONAL numbers. The appeal text length is staffConfig.minAppealLength / maxAppealLength.
export const appealConfig = {
  windowDays: 30, // the author of a removed post / comment can appeal within this many days of the removal (once)
  dueDays: 7, // an appeal that waits longer than this for a decision is flagged OVERDUE in `npm run appeals -- list`
  excerptLength: 80, // how many characters of the post title / comment text go into the appeal page and the email
};

// Shared power (TODO 42, PROJECT.md principle 5 + 8h). PROVISIONAL numbers: tune after real use.
export const modConfig = {
  largeMemberThreshold: 1000, // a community with this many members or more is "large"
  maxLargeCommunities: 3, // one person may lead at most this many large communities (small ones are not limited)
};

// Final erasure (TODO 36e, `npm run purge`). PROVISIONAL numbers, to be confirmed by a lawyer (PROJECT.md 8c).
export const purgeConfig = {
  warnBeforeHours: 24, // the "your data will be erased" email goes out when the erase date is this close (or passed)
  minWarningHours: 12, // an account is erased only if that email was sent at least this long ago (and the date has passed)
  afterAppealDays: 3, // after an appeal is decided, wait this many days (the person is told again, can still export)
  recordDays: 180, // a safety record is kept this long after the erasure
  recordSeriousDays: 730, // ... and this long after a ban for a serious site rule (about 2 years)
};

// Fair ranking of the Popular page (TODO 37, PROJECT.md 8e). The rules are in src/lib/ranking.ts; the numbers are here only.
// The /fairness page reads risingEvery, risingWindowHours and seedHours from here, so the page and the code cannot disagree.
// PROVISIONAL: tune after real use (a test with real people is part of Phase 5).
export const rankingConfig = {
  halfLifeHours: 72, // a post's vote score halves every 3 days
  sameAuthorFactor: 0.5, // each earlier post of the same author already on the page halves the next one
  risingEvery: 4, // every 4th place of the page is reserved for a new voice
  risingWindowHours: 48, // a new-voice post must be at most this old to use a reserved place
  risingLuck: 2, // weight of the fair draw next to log2(1 + votes) in the reserved places
  newAccountDays: 30, // an account younger than this is a "new voice" ...
  newVoiceMaxPosts: 3, // ... and so is an account with this many visible posts or fewer
  seedHours: 6, // the fair draw is the same inside one window of this many hours, then changes
  maxCandidates: 300, // only the best N posts go through the careful placing; the rest follow in plain order (nothing is dropped)
};

// Report a Social post (SOCIAL_TODO 30). PROVISIONAL numbers. Counted in server memory (a shared limiter is TODO 50).
export const socialReportConfig = {
  minReason: 5, // the reporter's reason: at least this many characters
  maxReason: 500,
  reports: [
    { max: 10, windowSeconds: 60 },
    { max: 50, windowSeconds: 24 * 60 * 60 },
  ], // reports per person
};

// Replies to a Social post (SOCIAL_TODO 18). PROVISIONAL numbers. The rate limit is counted from the database.
export const socialReplyConfig = {
  maxBody: 1000, // characters in one reply (a post can have 5,000)
  listSize: 200, // replies shown under one post
  limits: [
    { max: 10, windowMinutes: 10 },
    { max: 100, windowMinutes: 24 * 60 },
  ], // replies per person
};

// Reply control (SOCIAL_TODO B9). PROVISIONAL numbers. Hiding / showing again a reply under your own post, counted in server memory (TODO 50).
export const socialReplyControl = {
  hideLimits: [
    { max: 60, windowSeconds: 60 },
    { max: 600, windowSeconds: 24 * 60 * 60 },
  ],
};
// Fair ranking of replies under a Social post (SOCIAL_TODO B10, ACCOUNT_RULES.md 3.22). PROVISIONAL numbers.
// Same rules and same meaning as rankingConfig (the Popular page), tuned for one conversation: replies fade slower (7 days).
export const socialReplyRank = {
  halfLifeHours: 168,
  sameAuthorFactor: 0.5,
  risingEvery: 4,
  risingWindowHours: 72,
  risingLuck: 2,
  newAccountDays: 30,
  newVoiceMaxPosts: 3,
  seedHours: 6,
  maxCandidates: 300,
};
