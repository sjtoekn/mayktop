"use client";

import { useState } from "react";
import Icon from "@/components/shell/Icon";

// Share the profile: opens the phone's share sheet when there is one,
// otherwise copies the link and briefly says so.
export default function ShareButton({
  label,
  copiedLabel,
  title,
}: {
  label: string;
  copiedLabel: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
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
      <button type="button" className="pf-btn pf-btnIcon" onClick={share} aria-label={label} title={label}>
        <Icon name="share2" size={22} />
      </button>
      <span className="pf-srOnly" role="status" aria-live="polite">
        {copied ? copiedLabel : ""}
      </span>
      {copied && <span className="pf-toast" aria-hidden="true">{copiedLabel}</span>}
    </>
  );
}
