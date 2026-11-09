"use client";

// The Save button of the photo page (patch-photo-save). Same look and behaviour as the Social post Save button (classes in
// app/content.css). Private: there is no count, nobody else sees it. The server action gives the real state back.
import { useState, useTransition } from "react";
import Icon from "@/components/shell/Icon";
import { setPhotoBookmark } from "@/app/(site)/photos/bookmark/actions";

export type PhotoBookmarkText = {
  save: string;
  saved: string;
  saveTitle: string;
  savedTitle: string;
  login: string;
  tooMany: string;
  full: string;
  error: string;
};

export default function PhotoBookmarkButton({
  photoId,
  initialBookmarked,
  text,
}: {
  photoId: number;
  initialBookmarked: boolean;
  text: PhotoBookmarkText;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      const result = await setPhotoBookmark(photoId, !bookmarked);
      if ("error" in result) {
        setError(result.login ? text.login : result.tooMany ? text.tooMany : result.full ? text.full : text.error);
        return;
      }
      setBookmarked(result.bookmarked);
    });
  }

  return (
    <span className="sp-likeWrap">
      <button
        type="button"
        className={`pc-pill sp-bookmarkButton${bookmarked ? " is-saved" : ""}`}
        onClick={toggle}
        disabled={pending}
        aria-pressed={bookmarked}
        title={bookmarked ? text.savedTitle : text.saveTitle}
      >
        <Icon name="bookmark" size={18} fill={bookmarked ? "currentColor" : "none"} /> {bookmarked ? text.saved : text.save}
      </button>
      {error && (
        <span className="sp-likeError" role="status">
          {error}
        </span>
      )}
    </span>
  );
}
