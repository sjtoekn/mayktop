export type Rule = { title: string; text: string };

export type Community = {
  slug: string;
  name: string;
  description: string;
  members: number;
  rules: Rule[];
};

export type Post = {
  id: number;
  community: string; // community slug
  author: string;
  time: string;
  title: string;
  body: string;
  votes: number;
  comments: number;
  hidden?: { rule: string; note: string };
};

export type Comment = {
  id: number;
  author: string;
  time: string;
  text: string;
  votes: number;
  // Set when a comment is hidden for review (never deleted). Same shape as Post.hidden.
  hidden?: { rule: string; note: string };
  replies?: Comment[];
};

// ---- Home page sample data (replaced by database reads in Phase 2) ----
// Emoji and gradient colours are only decoration for the demo cards.
export type TrendingTopic = {
  rank: number;
  title: string;
  views: number;
  emoji: string;
  gradient: string; // CSS gradient
};

// Decoration for the right-hand thumbnail on post cards (demo only; real images come with uploads).
export const communityArt: Record<string, { emoji: string; gradient: string }> = {
  learning: { emoji: "📚", gradient: "linear-gradient(135deg,#ffd28a,#e07a1f)" },
  technology: { emoji: "💻", gradient: "linear-gradient(135deg,#3a86ff,#0a1f5c)" },
  "everyday-life": { emoji: "💡", gradient: "linear-gradient(135deg,#ffe27a,#f5a300)" },
  "health-basics": { emoji: "🥗", gradient: "linear-gradient(135deg,#8ee6b0,#1b9e5a)" },
  "local-news": { emoji: "🌍", gradient: "linear-gradient(135deg,#7fd8ff,#2ec4b6)" },
};
// Sidebar icon for each community (names come from components/shell/Icon.tsx).
export const communityIcon: Record<string, string> = {
  learning: "book",
  technology: "laptop",
  "everyday-life": "bulb",
  "health-basics": "heart",
  "local-news": "globe",
};

export const defaultArt = { emoji: "✨", gradient: "linear-gradient(135deg,#c7b8ff,#6d4aff)" };

// Each community has its own 3-5 short, plain-language rules (shown before posting).
const r = (title: string, text: string): Rule => ({ title, text });
const respect = r("Be respectful to others", "Disagree with ideas, not with people.");
const noSpam = r("No spam or scams", "No repeated promotions or misleading links.");

export const communities: Community[] = [
  {
    slug: "learning", name: "Learning", members: 1280,
    description: "Questions and answers for anyone learning something new.",
    rules: [
      r("Stay on topic", "Posts should be about learning something."),
      r("Be kind to beginners", "Every expert was a beginner once."),
      r("Say what you tried", "It helps others give a better answer."),
      noSpam,
    ],
  },
  {
    slug: "technology", name: "Technology", members: 2410,
    description: "Everyday technology help, in plain language.",
    rules: [
      r("Describe the problem clearly", "Name the device, the app and what went wrong."),
      respect,
      r("No piracy or hacking help", "Keep advice safe and legal."),
      noSpam,
    ],
  },
  {
    slug: "everyday-life", name: "Everyday Life", members: 960,
    description: "Small habits, tips and stories from daily life.",
    rules: [
      r("Share real experiences", "Tell what actually worked for you."),
      respect,
      r("No selling or promotion", "This is a place to talk, not to advertise."),
    ],
  },
  {
    slug: "health-basics", name: "Health Basics", members: 740,
    description: "General wellbeing discussion. Not medical advice.",
    rules: [
      r("Share information, not diagnoses", "Only a doctor can diagnose."),
      respect,
      r("Name your sources", "Say where health claims come from."),
      noSpam,
    ],
  },
  {
    slug: "local-news", name: "Local News", members: 530,
    description: "What is happening around us, with sources.",
    rules: [
      r("Include a source", "Link to the official notice or report."),
      r("Keep it local", "News should relate to our area."),
      respect,
      r("No rumours as facts", "Say clearly what is confirmed and what is not."),
    ],
  },
];

const basePosts: Post[] = [
  {
    id: 1, community: "learning", author: "newcomer_42", time: "12 min ago",
    title: "What is the easiest way to start learning to code with no experience?",
    body: "I have never written a line of code. I would like a simple plan for the first month, something I can follow without feeling lost.",
    votes: 8, comments: 5,
  },
  {
    id: 2, community: "technology", author: "maya_r", time: "40 min ago",
    title: "Why does my phone battery drain faster after every update?",
    body: "Three updates in a row and the battery is clearly worse. Is this normal, or is there something I can check in the settings?",
    votes: 23, comments: 14,
  },
  {
    id: 3, community: "everyday-life", author: "quiet_reader", time: "1 hour ago",
    title: "Small habits that actually made your mornings calmer",
    body: "Not looking for big life changes, just small things that really worked for you and took less than five minutes.",
    votes: 61, comments: 37,
  },
  {
    id: 4, community: "health-basics", author: "sam_k", time: "2 hours ago",
    title: "Example of a post hidden for review",
    body: "", votes: 2, comments: 0,
    hidden: {
      rule: "Rule 2: Be respectful to others",
      note: "A reviewer is checking whether this post breaks the rule. It has not been deleted.",
    },
  },
  {
    id: 5, community: "local-news", author: "town_watcher", time: "3 hours ago",
    title: "Road works near the main bridge: how long will it last?",
    body: "Has anyone seen the official notice? Trying to plan my daily route and cannot find a clear end date.",
    votes: 17, comments: 9,
  },
  {
    id: 6, community: "learning", author: "grammar_fan", time: "5 hours ago",
    title: "Best free resources for improving English grammar?",
    body: "I can read well but my writing has many mistakes. Looking for free, simple resources with exercises.",
    votes: 12, comments: 0,
  },
  {
    id: 7, community: "technology", author: "careful_user", time: "6 hours ago",
    title: "How can I tell if a website is safe before entering my email?",
    body: "I keep seeing sites asking for my email to continue. What are the quick signs that a site is trustworthy?",
    votes: 29, comments: 0,
  },
];

const commentsByPost: Record<number, Comment[]> = {
  1: [
    {
      id: 101, author: "helpful_dev", time: "8 min ago", votes: 4,
      text: "Pick one language (Python is a good first one) and do 20 minutes a day. Small daily practice beats long weekend sessions.",
      replies: [
        {
          id: 102, author: "newcomer_42", time: "5 min ago", votes: 1,
          text: "Thank you! Is there a free site you recommend for the first lessons?",
          replies: [
            {
              id: 104, author: "helpful_dev", time: "4 min ago", votes: 2,
              text: "Yes. Look for a free beginner course that has exercises you type yourself, not only videos.",
              replies: [
                {
                  id: 105, author: "ana_learns", time: "3 min ago", votes: 1,
                  text: "I did the same. Ten small exercises in the first week helped me more than any video.",
                  replies: [
                    { id: 106, author: "newcomer_42", time: "2 min ago", votes: 0, text: "That sounds doable. I will start tonight." },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    { id: 103, author: "ana_learns", time: "6 min ago", votes: 2, text: "Build tiny things early, like a calculator. It makes the ideas stick." },
  ],
  2: [
    {
      id: 201, author: "tech_tina", time: "30 min ago", votes: 9,
      text: "After an update the phone re-indexes apps and photos in the background. Give it two or three days, then check the battery usage screen.",
      replies: [
        {
          // Example of a comment hidden for review (its replies stay visible)
          id: 202, author: "grumpy_guest", time: "25 min ago", votes: 0,
          text: "",
          hidden: {
            rule: "Rule 2: Be respectful to others",
            note: "A reviewer is checking whether this comment breaks the rule. It has not been deleted.",
          },
          replies: [
            { id: 203, author: "tech_tina", time: "20 min ago", votes: 3, text: "Happy to help. If it is still bad after three days, tell me the phone model." },
          ],
        },
      ],
    },
  ],
  3: [
    { id: 301, author: "early_bird", time: "50 min ago", votes: 15, text: "Drinking a glass of water and opening the curtains before touching my phone." },
    { id: 302, author: "slow_sunday", time: "40 min ago", votes: 6, text: "Preparing clothes the night before. It sounds tiny but it removes a decision." },
  ],
  5: [
    { id: 501, author: "daily_commuter", time: "2 hours ago", votes: 5, text: "The council page says about three weeks, but I would wait for the next official update." },
  ],
};

function countComments(list: Comment[]): number {
  return list.reduce((sum, c) => sum + 1 + countComments(c.replies ?? []), 0);
}

// The number shown on a post is always the real number of sample comments.
export const samplePosts: Post[] = basePosts.map((p) => ({
  ...p,
  comments: countComments(commentsByPost[p.id] ?? []),
}));

export function getCommunity(slug: string) {
  return communities.find((c) => c.slug === slug);
}
export function getPost(id: number) {
  return samplePosts.find((p) => p.id === id);
}
export function postsByCommunity(slug: string) {
  return samplePosts.filter((p) => p.community === slug);
}
export function getComments(postId: number): Comment[] {
  return commentsByPost[postId] ?? [];
}

// ---- Public moderation log sample data (Phase 3 reads the real audit log) ----
// Every entry has a rule AND a reason: nothing is changed in secret.
export type ModActionKind = "hidden" | "restored" | "removed" | "appealUpheld" | "appealDenied";

export type ModLogEntry = {
  id: number;
  time: string;
  moderator: string;
  action: ModActionKind;
  target: "post" | "comment";
  community: string; // community slug
  subject: string; // short description of the content
  rule: string;
  reason: string;
  postId?: number; // set when the content exists in the sample data (adds a link)
};

export const modLog: ModLogEntry[] = [
  {
    id: 1, time: "20 min ago", moderator: "mod_ravi", action: "hidden",
    target: "comment", community: "technology", postId: 2,
    subject: "Comment by grumpy_guest",
    rule: "Rule 2: Be respectful to others",
    reason: "The comment was reported as insulting. Hidden while a second reviewer checks it. Not deleted.",
  },
  {
    id: 2, time: "2 hours ago", moderator: "mod_nadia", action: "hidden",
    target: "post", community: "health-basics", postId: 4,
    subject: "Post by sam_k",
    rule: "Rule 2: Be respectful to others",
    reason: "The post was reported. Hidden while a reviewer checks whether it breaks the rule. Not deleted.",
  },
  {
    id: 3, time: "5 hours ago", moderator: "mod_ravi", action: "restored",
    target: "post", community: "local-news",
    subject: "Post about a closed road",
    rule: "Rule 1: Include a source",
    reason: "The author added the official notice as a source, so the post follows the rule again.",
  },
  {
    id: 4, time: "Yesterday", moderator: "mod_kasun", action: "removed",
    target: "comment", community: "everyday-life",
    subject: "Comment advertising a shop",
    rule: "Rule 3: No selling or promotion",
    reason: "The comment only promoted a shop and had no link to the discussion. The author was told which rule applies.",
  },
  {
    id: 5, time: "Yesterday", moderator: "mod_nadia", action: "appealUpheld",
    target: "post", community: "learning",
    subject: "Post about free coding sites",
    rule: "Rule 4: No spam or scams",
    reason: "On appeal, a different moderator found the links were helpful and not spam. The post is visible again.",
  },
  {
    id: 6, time: "2 days ago", moderator: "mod_kasun", action: "appealDenied",
    target: "post", community: "technology",
    subject: "Post asking for a cracked app",
    rule: "Rule 3: No piracy or hacking help",
    reason: "On appeal, a second moderator confirmed that the post asks for pirated software.",
  },
];

export const trendingTopics: TrendingTopic[] = [
  { rank: 1, title: "Best Travel Tips", views: 12400, emoji: "🌴", gradient: "linear-gradient(135deg,#7fd8ff,#2ec4b6)" },
  { rank: 2, title: "Easy Healthy Food", views: 10800, emoji: "🥗", gradient: "linear-gradient(135deg,#ffd28a,#e07a1f)" },
  { rank: 3, title: "Latest Tech News", views: 9100, emoji: "📱", gradient: "linear-gradient(135deg,#3a86ff,#0a1f5c)" },
  { rank: 4, title: "Life Hacks", views: 7600, emoji: "💡", gradient: "linear-gradient(135deg,#ffe27a,#f5a300)" },
  { rank: 5, title: "Fun Facts", views: 6900, emoji: "🌍", gradient: "linear-gradient(135deg,#4a90e2,#0b2a4a)" },
];

// ---- Search (Phase 1: plain text match over the sample data) ----
// Order is the data order, NOT popularity (fairness principle). Hidden posts
// are left out, the same as on the Popular page. Phase 2 moves this to the database.
export function searchSample(query: string): { communities: Community[]; posts: Post[] } {
  const q = query.trim().toLowerCase();
  if (!q) return { communities: [], posts: [] };
  const has = (s: string) => s.toLowerCase().includes(q);
  return {
    communities: communities.filter((c) => has(c.name) || has(c.slug) || has(c.description)),
    posts: samplePosts.filter((p) => !p.hidden && (has(p.title) || has(p.body) || has(p.author))),
  };
}
