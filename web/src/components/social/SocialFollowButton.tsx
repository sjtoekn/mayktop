"use client";

import { useState, useTransition } from "react";
import { setSocialFollow } from "@/app/(site)/social/follow/actions";

// All visible text comes in as props (translated on the server), so this file has no words.
export type SocialFollowText = {
  follow: string; // button text when not following
  following: string; // button text when following
  followLabel: string; // accessible name, e.g. "Follow @maya"
  unfollowLabel: string; // accessible name, e.g. "Unfollow @maya"
  login: string;
  tooMany: string;
  error: string;
};

type Props = {
  username: string;
  initialFollowing: boolean;
  text: SocialFollowText;
};

/** Follow / Unfollow under a Social post. The page decides who sees it (never for your own posts); the server checks again. */
export default function SocialFollowButton({ username, initialFollowing, text }: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
    setError("");

    startTransition(async () => {
      const result = await setSocialFollow(username, !following);

      if ("error" in result) {
        setError(result.login ? text.login : result.tooMany ? text.tooMany : text.error);
        return;
      }

      setFollowing(result.following);
    });
  }

  return (
    <span className="sp-likeWrap">
      <button
        type="button"
        className={`pc-pill sp-followButton${following ? " is-following" : ""}`}
        onClick={toggle}
        disabled={pending}
        aria-pressed={following}
        aria-label={following ? text.unfollowLabel : text.followLabel}
      >
        {following ? text.following : text.follow}
      </button>

      {error && (
        <span className="sp-likeError" role="status">
          {error}
        </span>
      )}
    </span>
  );
}
