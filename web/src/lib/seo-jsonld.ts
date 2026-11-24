// Structured data (JSON-LD) for a post page (SEO stage 3). Pure code (no database): npm run test:seo-jsonld
// Google reads this next to the visible page. Only what the page already shows is put in it.
import { absoluteUrl } from "./site-url";
import { cutText, summarize } from "./seo-text";

/** JSON for a <script type="application/ld+json"> tag. "<", ">" and "&" are escaped so that a post can never close the tag early. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export type PostLdInput = {
  id: number;
  title: string;
  body: string;
  /** Username of the author, or "" when it must not be shown. */
  author: string;
  createdAtMs: number;
  comments: number;
};

/** A post as a "DiscussionForumPosting". The caller gives this only for posts that anybody may see (not hidden, not erased). */
export function postJsonLd(input: PostLdInput, env: string | undefined = process.env.SITE_URL): Record<string, unknown> {
  const url = absoluteUrl(`/post/${input.id}`, env);
  const text = summarize(input.body, 500);
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    "@id": url,
    url,
    mainEntityOfPage: url,
    headline: cutText(input.title, 110),
    ...(text ? { text } : {}),
    datePublished: new Date(input.createdAtMs).toISOString(),
    ...(input.author
      ? { author: { "@type": "Person", name: input.author, url: absoluteUrl(`/u/${encodeURIComponent(input.author)}`, env) } }
      : {}),
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: input.comments,
    },
  };
}
