"use client";

// The Like button of the photo page (PHOTO_TODO 7). Same look and behaviour as the Social post button (classes in
// app/content.css). The server action gives the real state back, so the number is always the one in the database.
import { useState, useTransition } from "react";
import { setPhotoLike } from "@/app/(site)/photos/like/actions";

export type PhotoLikeText = {
  like: string;
  unlike: string;
  likeTitle: string;
  unlikeTitle: string;
  login: string;
  tooMany: string;
  error: string;
};

export default function PhotoLikeButton({
  photoId,
  initialLiked,
  initialCount,
  text,
}: {
  photoId: number;
  initialLiked: boolean;
  initialCount: number;
  text: PhotoLikeText;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      const result = await setPhotoLike(photoId, !liked);
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
