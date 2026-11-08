"use client";

import { useState, useTransition } from "react";
import { setSocialReplyLike } from "@/app/(site)/social/reply-like/actions";

// Like a reply (SOCIAL_TODO B10). All visible text comes in as props (translated on the server); the server checks everything again.
export type SocialReplyLikeText = { like: string; unlike: string; login: string; tooMany: string; error: string };

export default function SocialReplyLikeButton({
  replyId,
  initialLiked,
  initialCount,
  text,
}: {
  replyId: number;
  initialLiked: boolean;
  initialCount: number;
  text: SocialReplyLikeText;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      const result = await setSocialReplyLike(replyId, !liked);
      if ("error" in result) {
        setError(result.login ? text.login : result.tooMany ? text.tooMany : text.error);
        return;
      }
      setLiked(result.liked);
      setCount(result.likes);
    });
  }

  return (
    <span className="sp-likeWrap">
      <button
        type="button"
        className={`pc-pill sp-likeButton${liked ? " is-liked" : ""}`}
        onClick={toggle}
        disabled={pending}
        aria-pressed={liked}
        aria-label={liked ? text.unlike : text.like}
        title={liked ? text.unlike : text.like}
      >
        {liked ? "♥" : "♡"} {count}
      </button>
      {error && <span className="sp-likeError" role="status">{error}</span>}
    </span>
  );
}
