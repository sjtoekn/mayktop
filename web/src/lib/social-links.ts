// Web addresses in a Social post (patch-social-links). Plain functions, no database, so a test can run them.
// Nothing is saved for a link: the address stays inside the text of the post, and these functions find it again when the post is shown
// (and in the post form, as a live preview). So old posts, editing, moderation and export need no change.
//
// Rules (PROJECT.md 8j.7, provisional):
//  - Only http: and https: addresses. No user name / password inside the address, a real host name (with a dot), at most 2,000 characters.
//  - A full stop, comma, bracket or similar sign at the very end of an address belongs to the sentence, not to the address.
//  - The FIRST usable address of a post gets a preview under the text: a YouTube video is played on our own page (click to play,
//    youtube-nocookie.com, no YouTube code is loaded before the click); any other address becomes a plain link card. Not fetched by the
//    server (no page is downloaded, so there is nothing to abuse). Every address in the text is a link.
//  - The video id is checked (11 letters, numbers, - and _) before it is used, so nothing else can ever end up in the player address.
export const SOCIAL_LINK_MAX_LENGTH = 2000;

const URL_RE = /https?:\/\/[^\s<>"'`​-‏⁠﻿]+/giu;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export type LinkPart = { kind: "text"; text: string } | { kind: "url"; text: string; href: string };

export type PostLink =
  | { kind: "youtube"; href: string; id: string; start: number }
  | { kind: "link"; href: string; host: string; shown: string };

/** The usable form of one address, or null. `raw` is cut at the first space already. */
function parseHttpUrl(raw: string): URL | null {
  if (raw.length > SOCIAL_LINK_MAX_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "") return null; // https://google.com@evil.example looks like another site
  if (!url.hostname.includes(".")) return null;
  return url;
}

/** Signs at the very end belong to the sentence. A ")" stays only when its "(" is inside the address (Wikipedia: .../Foo_(bar)). */
function trimAddress(candidate: string): string {
  let text = candidate;
  while (text.length > 0) {
    const last = text[text.length - 1];
    if (last === ")") {
      const open = (text.match(/\(/g) ?? []).length;
      const close = (text.match(/\)/g) ?? []).length;
      if (close > open) {
        text = text.slice(0, -1);
        continue;
      }
      break;
    }
    if (/[.,;:!?'"\]}»…]/u.test(last)) {
      text = text.slice(0, -1);
      continue;
    }
    break;
  }
  return text;
}

/** The text cut into plain text and addresses, for showing. Putting every `text` together gives the original text back. */
export function splitLinks(body: string): LinkPart[] {
  const text = typeof body === "string" ? body : "";
  const parts: LinkPart[] = [];
  let at = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const address = trimAddress(match[0]);
    const url = parseHttpUrl(address);
    if (!url) continue;
    if (start > at) parts.push({ kind: "text", text: text.slice(at, start) });
    parts.push({ kind: "url", text: address, href: url.href });
    at = start + address.length;
  }
  if (at < text.length) parts.push({ kind: "text", text: text.slice(at) });
  return parts;
}

/** "1h2m3s", "90s", "90" -> seconds (0 when it makes no sense, at most 12 hours). */
function parseStart(value: string | null): number {
  if (!value) return 0;
  const plain = /^(\d{1,6})s?$/.exec(value);
  if (plain) return Math.min(Number(plain[1]), 43_200);
  const parts = /^(?:(\d{1,3})h)?(?:(\d{1,4})m)?(?:(\d{1,6})s)?$/.exec(value);
  if (!parts || !(parts[1] || parts[2] || parts[3])) return 0;
  const seconds = Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0);
  return Math.min(seconds, 43_200);
}

/** The YouTube video of an address (watch, youtu.be, shorts, embed, live), or null. A playlist address without a video is not a video. */
export function parseYouTube(href: string): { id: string; start: number } | null {
  const url = parseHttpUrl(href);
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let id: string | null = null;

  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
    const [, first, second] = url.pathname.split("/");
    if (first === "watch") id = url.searchParams.get("v");
    else if (first === "shorts" || first === "embed" || first === "live" || first === "v") id = second ?? null;
  }
  if (!id || !VIDEO_ID_RE.test(id)) return null;
  return { id, start: parseStart(url.searchParams.get("t") ?? url.searchParams.get("start")) };
}

/** What to show under the text of a post: the first usable address (a YouTube video, or a link card), or null. */
export function findPostLink(body: string): PostLink | null {
  for (const part of splitLinks(body)) {
    if (part.kind !== "url") continue;
    const video = parseYouTube(part.href);
    if (video) return { kind: "youtube", href: part.href, id: video.id, start: video.start };
    const url = new URL(part.href);
    const host = url.hostname.replace(/^www\./i, "");
    const path = url.pathname === "/" ? "" : decodeSafely(url.pathname);
    const shown = (host + path).length > 80 ? (host + path).slice(0, 79) + "…" : host + path;
    return { kind: "link", href: part.href, host, shown };
  }
  return null;
}

function decodeSafely(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** Is this one address (as typed in the "Add a link" field) usable? Returns the cleaned address or null. */
export function cleanTypedLink(input: string): string | null {
  const text = (typeof input === "string" ? input : "").trim();
  if (text === "" || /\s/u.test(text)) return null;
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  const url = parseHttpUrl(withScheme);
  return url ? url.href : null;
}

/** The address of the player: only a checked id and a number go into it. */
export function youTubeEmbedSrc(id: string, start: number, autoplay: boolean): string {
  if (!VIDEO_ID_RE.test(id)) return "";
  const params = new URLSearchParams({ rel: "0", playsinline: "1" });
  if (autoplay) params.set("autoplay", "1");
  if (Number.isInteger(start) && start > 0) params.set("start", String(start));
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

/** The still picture shown before the click. */
export function youTubeThumbSrc(id: string): string {
  return VIDEO_ID_RE.test(id) ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "";
}
