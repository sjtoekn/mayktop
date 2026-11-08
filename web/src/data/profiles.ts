import type { MessageKey } from "@/i18n/messages/en";

// Sample profile data (UI only, Phase 1). In Phase 2 this comes from the database.
// Dates are stored as ISO text (UTC) and shown in the reader's language.

export type Interest = { labelKey: MessageKey; tone: 1 | 2 | 3 | 4 | 5 }; // tone = colour (pc-a1..pc-a5 in content.css)

export type BadgeId = "topCreator" | "activeMember" | "communityHelper";

export type Profile = {
  username: string;
  name: string;
  verified: boolean;
  tagline: string[]; // shown as "Dream Big • Think Positive • Achieve More"
  bio: string;
  location: string;
  joined: string; // ISO date, UTC
  website?: string; // without https://
  avatarUrl?: string; // put the image in /public and use e.g. "/avatars/sjethan.jpg"
  coverUrl?: string; // same for the cover, e.g. "/covers/sjethan.jpg"
  avatarGradient: string; // used when there is no avatar photo
  stats: { posts: number; followers: number; following: number };
  interests: Interest[];
  badges: BadgeId[];
  communities: string[]; // community slugs (see data/sample.ts)
  postIds: number[];
  likedIds: number[];
  savedIds: number[];
};

export type PostArt = "hiker" | "sea";

export type ProfilePost = {
  id: number;
  author: string; // username
  time: string; // sample text, like the rest of the sample data
  isPublic: boolean;
  text: string;
  art?: PostArt;
  likes: number;
  comments: number;
};

// Until sign-in exists (Phase 2), this is "the person who is logged in".
export const currentUsername = "sjethan";

const interest = {
  motivation: { labelKey: "profile.interest.motivation", tone: 1 },
  technology: { labelKey: "home.cat.technology", tone: 5 },
  travel: { labelKey: "home.cat.travel", tone: 2 },
  selfgrowth: { labelKey: "profile.interest.selfgrowth", tone: 3 },
  health: { labelKey: "home.cat.health", tone: 4 },
} satisfies Record<string, Interest>;

export const profiles: Profile[] = [
  {
    username: "sjethan",
    name: "SJ Ethan",
    verified: true,
    tagline: ["Dream Big", "Think Positive", "Achieve More"],
    bio: "I'm SJ Ethan. I love sharing positive thoughts, motivation and life tips to help you live a happier and more successful life. 🚀",
    location: "Sri Lanka",
    joined: "2025-01-15",
    website: "youtube.com/@sjethan",
    avatarGradient: "linear-gradient(135deg,#31415f,#0f1b3d)",
    stats: { posts: 142, followers: 12500, following: 243 },
    interests: [interest.motivation, interest.technology, interest.travel, interest.selfgrowth, interest.health],
    badges: ["topCreator", "activeMember", "communityHelper"],
    communities: ["technology", "everyday-life", "health-basics", "learning"],
    postIds: [101, 102, 103],
    likedIds: [201, 202],
    savedIds: [201],
  },
  {
    username: "traveldreamer",
    name: "TravelDreamer",
    verified: false,
    tagline: ["See more", "Worry less"],
    bio: "Collecting beautiful places and sharing simple travel tips.",
    location: "Colombo",
    joined: "2025-03-02",
    avatarGradient: "linear-gradient(135deg,#2ec4b6,#3a86ff)",
    stats: { posts: 58, followers: 3200, following: 120 },
    interests: [interest.travel, interest.motivation],
    badges: ["activeMember"],
    communities: ["everyday-life"],
    postIds: [201],
    likedIds: [],
    savedIds: [],
  },
  {
    username: "gamezone",
    name: "GameZone",
    verified: false,
    tagline: ["Play fair", "Have fun"],
    bio: "Game picks and friendly tips for all players.",
    location: "Kandy",
    joined: "2025-05-20",
    avatarGradient: "linear-gradient(135deg,#8e44ad,#5b2c83)",
    stats: { posts: 41, followers: 2100, following: 95 },
    interests: [interest.technology],
    badges: ["communityHelper"],
    communities: ["technology"],
    postIds: [202],
    likedIds: [],
    savedIds: [],
  },
];

export const profilePosts: ProfilePost[] = [
  {
    id: 101, author: "sjethan", time: "2h ago", isPublic: true,
    text: "Believe in yourself. You are stronger than you think!",
    art: "hiker", likes: 842, comments: 128,
  },
  {
    id: 102, author: "sjethan", time: "1d ago", isPublic: true,
    text: "Small steps every day lead to big changes. Start today, even if it is only 10 minutes.",
    likes: 516, comments: 64,
  },
  {
    id: 103, author: "sjethan", time: "3d ago", isPublic: true,
    text: "Three habits that made my mornings calmer: a glass of water, a short walk, and no phone for the first 20 minutes.",
    art: "sea", likes: 377, comments: 41,
  },
  {
    id: 201, author: "traveldreamer", time: "2h ago", isPublic: true,
    text: "Most beautiful places you must visit! Here are some amazing destinations for your bucket list.",
    art: "sea", likes: 245, comments: 56,
  },
  {
    id: 202, author: "gamezone", time: "3h ago", isPublic: true,
    text: "Top 5 games you should try! They are super fun and perfect for all players. 🎮",
    likes: 189, comments: 72,
  },
];

export function getProfile(username: string) {
  return profiles.find((p) => p.username === username);
}

export function postsByIds(ids: number[]): ProfilePost[] {
  return ids
    .map((id) => profilePosts.find((p) => p.id === id))
    .filter((p): p is ProfilePost => p !== undefined);
}

/** "SJ Ethan" -> "SE" (shown when there is no profile photo). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}
