// The plain rules of "what a new post must contain" for each kind (SITE_PLAN A3). No database here, so they are easy to read
// and to test (npm run test:post-kind). The action in src/app/(site)/submit/actions.ts saves; the form only helps the person.
import { postKinds, postLimits, type PostKind } from "@/config/site";

export type PostInput = { kind: PostKind; title: string; body: string; videoUrl: string | null };
export type PostInputError = "kind" | "title" | "body" | "bodyShort" | "video";

export function isPostKind(value: unknown): value is PostKind {
  return typeof value === "string" && (postKinds as readonly string[]).includes(value);
}

/** A stored kind as one we know. An older post, or a key that was removed from the list, is a "question". */
export function postKindOf(value: string | null | undefined): PostKind {
  return isPostKind(value) ? value : "question";
}

export type VideoRef = { provider: "youtube" | "vimeo"; id: string; watchUrl: string; embedUrl: string };

/**
 * Reads a YouTube or Vimeo address. Returns null for anything else (another site, not https, a page that is not a video).
 * The id is cut down to the safe characters, so the address that is saved and the address that is embedded are always rebuilt
 * from it, never copied from what the person typed.
 */
export function parseVideoUrl(raw: string): VideoRef | null {
  const text = raw.trim();
  if (text.length === 0 || text.length > postLimits.videoUrlMax) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!(postLimits.videoHosts as readonly string[]).includes(host)) return null;
  const parts = url.pathname.split("/").filter(Boolean);

  let youtubeId: string | undefined;
  if (host === "youtu.be") youtubeId = parts[0];
  else if (host.endsWith("youtube.com")) {
    if (parts[0] === "watch") youtubeId = url.searchParams.get("v") ?? undefined;
    else if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") youtubeId = parts[1];
  }
  if (youtubeId !== undefined) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) return null;
    return {
      provider: "youtube",
      id: youtubeId,
      watchUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
    };
  }

  if (host.endsWith("vimeo.com") && /^\d{5,12}$/.test(parts[0] ?? "")) {
    const id = parts[0];
    return { provider: "vimeo", id, watchUrl: `https://vimeo.com/${id}`, embedUrl: `https://player.vimeo.com/video/${id}` };
  }
  return null;
}

/** Checks what the browser sent (it is not trusted). Returns the cleaned input, or the first thing that is wrong. */
export function checkPostInput(input: {
  kind?: unknown;
  title?: unknown;
  body?: unknown;
  videoUrl?: unknown;
}): { ok: true; value: PostInput } | { ok: false; error: PostInputError } {
  if (!isPostKind(input.kind)) return { ok: false, error: "kind" };
  if (typeof input.title !== "string" || typeof input.body !== "string") return { ok: false, error: "title" };
  const kind = input.kind;
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length === 0 || title.length > postLimits.titleMax) return { ok: false, error: "title" };
  if (body.length > postLimits.bodyMax) return { ok: false, error: "body" };

  if (kind === "article" && body.length < postLimits.articleBodyMin) return { ok: false, error: "bodyShort" };

  let videoUrl: string | null = null;
  if (kind === "video") {
    const ref = typeof input.videoUrl === "string" ? parseVideoUrl(input.videoUrl) : null;
    if (!ref) return { ok: false, error: "video" };
    videoUrl = ref.watchUrl; // the cleaned address, not the typed one
  }
  // The other kinds never keep a video address, even if one was sent.
  return { ok: true, value: { kind, title, body, videoUrl } };
}
