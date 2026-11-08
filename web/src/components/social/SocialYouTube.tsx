"use client";

import { useState } from "react";
import { youTubeEmbedSrc, youTubeThumbSrc } from "@/lib/social-links";

export type SocialYouTubeText = {
  /** "Play video" (button label) */
  play: string;
  /** "YouTube video" (title of the player) */
  title: string;
  /** "Open on YouTube" */
  open: string;
};

/**
 * A YouTube video played on our own page (patch-social-links). Click to play: before the click only the still picture is
 * loaded; the player (youtube-nocookie.com) is created by the click and starts at once. The player address is built from a
 * checked video id only (src/lib/social-links.ts).
 */
export default function SocialYouTube({ id, start, href, text }: { id: string; start: number; href: string; text: SocialYouTubeText }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="sp-video">
      <div className="sp-videoFrame">
        {playing ? (
          <iframe
            src={youTubeEmbedSrc(id, start, true)}
            title={text.title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
          />
        ) : (
          <button type="button" className="sp-videoPlay" onClick={() => setPlaying(true)} aria-label={text.play}>
            {/* eslint-disable-next-line @next/next/no-img-element -- the still picture of the video, loaded from YouTube's picture server */}
            <img src={youTubeThumbSrc(id)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            <span className="sp-videoIcon" aria-hidden="true">▶</span>
          </button>
        )}
      </div>
      <a className="sp-videoOpen" href={href} target="_blank" rel="noopener noreferrer nofollow ugc">
        {text.open} ↗
      </a>
    </div>
  );
}
