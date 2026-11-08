"use client";

import { useState, useTransition } from "react";
import Icon from "@/components/shell/Icon";
import { setSocialBookmark } from "@/app/(site)/social/bookmark/actions";

export type SocialBookmarkText = {
  save: string;
  saved: string;
  saveTitle: string;
  savedTitle: string;
  login: string;
  tooMany: string;
  full: string;
  error: string;
};

// Save a Social post for yourself (SOCIAL_TODO B2). Private: there is no count, nobody else sees it.
export default function SocialBookmarkButton({
  postId,
  initialBookmarked,
  text,
}: {
  postId: number;
  initialBookmarked: boolean;
  text: SocialBookmarkText;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
    setError("");

    startTransition(async () => {
      const result = await setSocialBookmark(postId, !bookmarked);

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
