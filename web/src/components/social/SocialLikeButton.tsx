"use client";

import { useState, useTransition } from "react";
import { setSocialPostLike } from "@/app/(site)/social/like/actions";

export type SocialLikeText = {
  like: string;
  unlike: string;
  likeTitle: string;
  unlikeTitle: string;
  login: string;
  tooMany: string;
  error: string;
};

type Props = {
  postId: number;
  initialLiked: boolean;
  initialCount: number;
  text: SocialLikeText;
};

export default function SocialLikeButton({
  postId,
  initialLiked,
  initialCount,
  text,
}: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggleLike() {
    if (pending) return;

    setError("");

    startTransition(async () => {
      const result = await setSocialPostLike(postId, !liked);

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
        onClick={toggleLike}
        disabled={pending}
        aria-pressed={liked}
        aria-label={liked ? text.unlike : text.like}
        title={liked ? text.unlikeTitle : text.likeTitle}
      >
        {liked ? "♥" : "♡"} {count}
      </button>

      {error && (
        <span className="sp-likeError" role="status">
          {error}
        </span>
      )}
    </span>
  );
}
