"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSocialReplyHidden } from "@/app/(site)/social/reply/actions";

// Hide / show again a reply under YOUR post (SOCIAL_TODO B9). Shown only to the author of the post; the server checks again.
// All visible text comes in as props (translated on the server). No confirmation: it is not a deletion and can be undone at once.
export type SocialReplyHideText = { hide: string; unhide: string; error: string };

export default function SocialReplyHideButton({ id, hidden, text }: { id: number; hidden: boolean; text: SocialReplyHideText }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      const result = await setSocialReplyHidden({ id, hidden: !hidden });
      if ("error" in result) {
        setError(text.error);
        return;
      }
      router.refresh(); // the reply moves between the list and the "Hidden replies" part
    });
  }

  return (
    <span className="sp-likeWrap">
      <button type="button" className="pc-pill pc-pill-sm" disabled={pending} onClick={toggle}>
        {hidden ? text.unhide : text.hide}
      </button>
      {error && <span className="sp-likeError" role="alert">{error}</span>}
    </span>
  );
}
