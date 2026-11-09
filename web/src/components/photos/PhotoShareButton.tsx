"use client";

import { useState } from "react";
import Icon from "@/components/shell/Icon";

// Share the link of ONE photo (PHOTO_TODO 6b): opens the phone's share sheet when there is one, otherwise copies the link
// and briefly says so. Same idea as SocialShareButton, but with a visible word. Only the link and the plain title are shared.
export default function PhotoShareButton({
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
      <button type="button" className="pc-pill" onClick={share}>
        <Icon name="share2" size={16} />
        {label}
      </button>
      <span className="sp-label" role="status" aria-live="polite">{copied ? copiedLabel : ""}</span>
    </>
  );
}
