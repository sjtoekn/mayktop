"use client";

import { useState } from "react";
import Icon from "@/components/shell/Icon";

// Share the link of ONE Social post (SOCIAL_TODO 14): opens the phone's share sheet when there is one, otherwise copies
// the link and briefly says so. The link is the post's own page (`path`), not the page the person is on.
// Only the link and a plain title are shared, never the post text (Social posts are for logged-in people only).
export default function SocialShareButton({
  path,
  label,
  copiedLabel,
  title,
}: {
  path: string;
  label: string;
  copiedLabel: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The person closed the share sheet or the browser blocked copying: nothing to do.
    }
  }

  return (
    <>
      <button type="button" className="pc-pill" onClick={share} aria-label={label} title={label}>
        <Icon name="share2" size={16} />
      </button>
      <span className="sp-label" role="status" aria-live="polite">{copied ? copiedLabel : ""}</span>
    </>
  );
}
