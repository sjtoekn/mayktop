import SocialYouTube, { type SocialYouTubeText } from "@/components/social/SocialYouTube";
import type { PostLink } from "@/lib/social-links";

export type SocialLinkPreviewText = SocialYouTubeText & {
  /** Accessible label of a link card: "Open link: {host}" (already filled in by the caller is not possible, so {host} is replaced here) */
  linkLabel: string;
};

/**
 * The preview under the text of a Social post, or in the post form (patch-social-links): a YouTube video that plays here,
 * or a plain link card for any other address. No page is downloaded, so a card shows the address only. Works on the server and in the browser.
 */
export default function SocialLinkPreview({ link, text }: { link: PostLink | null; text: SocialLinkPreviewText }) {
  if (!link) return null;
  if (link.kind === "youtube") {
    return <SocialYouTube id={link.id} start={link.start} href={link.href} text={text} />;
  }
  return (
    <a
      className="sp-linkCard"
      href={link.href}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      aria-label={text.linkLabel.replace("{host}", link.host)}
    >
      <span className="sp-linkIcon" aria-hidden="true">🔗</span>
      <span className="sp-linkText">
        <strong>{link.host}</strong>
        <span>{link.shown}</span>
      </span>
      <span aria-hidden="true">↗</span>
    </a>
  );
}
