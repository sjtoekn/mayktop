"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/shell/Icon";
import { setSocialPin } from "@/app/(site)/social/pin/actions";

export type SocialPinText = {
  pin: string;
  pinned: string;
  pinTitle: string;
  pinnedTitle: string;
  login: string;
  tooMany: string;
  notfound: string;
  error: string;
};

// Pin one of YOUR OWN posts to the top of your profile (SOCIAL_TODO B6). Shown only to the author (the server checks again).
export default function SocialPinButton({
  postId,
  initialPinned,
  text,
}: {
  postId: number;
  initialPinned: boolean;
  text: SocialPinText;
}) {
  const router = useRouter();
  const [pinned, setPinned] = useState(initialPinned);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      const result = await setSocialPin(postId, !pinned);
      if ("error" in result) {
        setError(result.login ? text.login : result.tooMany ? text.tooMany : result.notfound ? text.notfound : text.error);
        return;
      }
      setPinned(result.pinned);
      router.refresh(); // other cards on the page may show "Pinned" for the old post
    });
  }

  return (
    <span className="sp-likeWrap">
      <button
        type="button"
        className={`pc-pill sp-pinButton${pinned ? " is-pinned" : ""}`}
        onClick={toggle}
        disabled={pending}
        aria-pressed={pinned}
        title={pinned ? text.pinnedTitle : text.pinTitle}
      >
        <Icon name="pin" size={18} fill={pinned ? "currentColor" : "none"} /> {pinned ? text.pinned : text.pin}
      </button>

      {error && (
        <span className="sp-likeError" role="status">
          {error}
        </span>
      )}
    </span>
  );
}
