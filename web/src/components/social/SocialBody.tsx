import { Fragment } from "react";
import Link from "next/link";
import { tagHref, tokenizeSocialBody } from "@/lib/social-tags";
import { splitLinks } from "@/lib/social-links";

/**
 * The text of a Social post (SOCIAL_TODO 6, patch-social-links): plain text with every web address, saved hashtag and mention as a link.
 * Web addresses are cut out FIRST (src/lib/social-links.ts) and are never searched for hashtags or mentions, so `https://x.com/@name` is
 * one link. The rest is cut up by src/lib/social-tags.ts (the same rule that decided what was saved).
 * `mentions` = the usernames that were saved as mentioned (accounts that exist and may be shown); any other @name stays plain.
 * Plain links, no script. Server component.
 */
export default function SocialBody({ body, mentions }: { body: string; mentions: string[] }) {
  return (
    <p className="pc-text pc-text-full sp-body">
      {splitLinks(body).map((piece, pieceIndex) =>
        piece.kind === "url" ? (
          <a key={pieceIndex} href={piece.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="sp-url">
            {piece.text}
          </a>
        ) : (
          tokenizeSocialBody(piece.text, mentions).map((part, index) =>
            part.kind === "tag" ? (
              <Link key={`${pieceIndex}-${index}`} href={tagHref(part.value)} className="sp-tag">{part.text}</Link>
            ) : part.kind === "mention" ? (
              <Link key={`${pieceIndex}-${index}`} href={`/social/u/${part.value}`} className="sp-mention">{part.text}</Link>
            ) : (
              <Fragment key={`${pieceIndex}-${index}`}>{part.text}</Fragment>
            ),
          )
        ),
      )}
    </p>
  );
}
