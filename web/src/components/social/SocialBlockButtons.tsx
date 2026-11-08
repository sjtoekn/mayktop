"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSocialBlock, setSocialMute } from "@/app/(site)/social/block/actions";

// All visible text comes in as props (translated on the server), so this file has no words.
export type SocialBlockText = {
  mute: string;
  unmute: string;
  muteLabel: string; // accessible name, e.g. "Mute @maya"
  unmuteLabel: string;
  block: string;
  unblock: string;
  blockLabel: string;
  unblockLabel: string;
  confirm: string; // the question before a block, e.g. "Block @maya? ..."
  confirmYes: string;
  confirmNo: string;
  login: string;
  tooMany: string;
  error: string;
};

type Props = {
  username: string;
  initialMuted: boolean;
  initialBlocked: boolean;
  text: SocialBlockText;
};

/**
 * Mute / Block (and Unmute / Unblock) on a Social profile. The page decides who sees it (never on your own profile); the
 * server checks again. Blocking asks first. After a change the page is read again, because the feeds and the profile change.
 */
export default function SocialBlockButtons({ username, initialMuted, initialBlocked, text }: Props) {
  const router = useRouter();
  const [muted, setMuted] = useState(initialMuted);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function change(kind: "mute" | "block", desired: boolean) {
    if (pending) return;
    setError("");

    startTransition(async () => {
      const result = kind === "mute" ? await setSocialMute(username, desired) : await setSocialBlock(username, desired);

      if ("error" in result) {
        setError(result.login ? text.login : result.tooMany ? text.tooMany : text.error);
        return;
      }

      setAsking(false);
      if (kind === "mute") setMuted(result.on);
      else setBlocked(result.on);
      router.refresh();
    });
  }

  return (
    <span className="sp-likeWrap">
      {!blocked && (
        <button
          type="button"
          className={`pc-pill sp-followButton${muted ? " is-following" : ""}`}
          onClick={() => change("mute", !muted)}
          disabled={pending}
          aria-pressed={muted}
          aria-label={muted ? text.unmuteLabel : text.muteLabel}
        >
          {muted ? text.unmute : text.mute}
        </button>
      )}

      {blocked ? (
        <button
          type="button"
          className="pc-pill sp-followButton is-following"
          onClick={() => change("block", false)}
          disabled={pending}
          aria-label={text.unblockLabel}
        >
          {text.unblock}
        </button>
      ) : asking ? (
        <span role="group" aria-label={text.blockLabel}>
          <span className="pc-text">{text.confirm}</span>{" "}
          <button type="button" className="pc-pill" onClick={() => change("block", true)} disabled={pending}>
            {text.confirmYes}
          </button>{" "}
          <button type="button" className="pc-pill" onClick={() => setAsking(false)} disabled={pending}>
            {text.confirmNo}
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="pc-pill sp-followButton"
          onClick={() => setAsking(true)}
          disabled={pending}
          aria-label={text.blockLabel}
        >
          {text.block}
        </button>
      )}

      {error && (
        <span className="sp-likeError" role="status">
          {error}
        </span>
      )}
    </span>
  );
}
