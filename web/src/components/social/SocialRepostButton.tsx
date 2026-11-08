"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSocialRepost } from "@/app/(site)/social/repost/actions";
import "@/app/(site)/manage/owner.css";

// All visible text comes in as props (translated on the server), so this file has no words.
export type SocialRepostText = {
  repost: string; // accessible name when not reposted, e.g. "Repost this post"
  unrepost: string; // accessible name when reposted, e.g. "Undo your repost"
  quote: string; // button that opens the quote box
  field: string; // label of the quote box
  submit: string;
  cancel: string;
  saving: string;
  login: string;
  tooMany: string;
  invalid: string;
  error: string;
};

const MAX = 5000;

type Props = {
  postId: number;
  initialReposted: boolean;
  initialCount: number;
  text: SocialRepostText;
};

/** Repost / Undo and Quote under a Social post. The server checks everything again; the person comes from the login cookie. */
export default function SocialRepostButton({ postId, initialReposted, initialCount, text }: Props) {
  const router = useRouter();
  const [reposted, setReposted] = useState(initialReposted);
  const [count, setCount] = useState(initialCount);
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function run(action: "repost" | "quote" | "undo", quoteText?: string) {
    if (pending) return;
    setError("");

    startTransition(async () => {
      const result = await setSocialRepost({ postId, action, quote: quoteText });

      if ("error" in result) {
        setError(result.login ? text.login : result.tooMany ? text.tooMany : result.invalid ? text.invalid : text.error);
        return;
      }

      setReposted(result.reposted);
      setCount(result.reposts);
      if (action === "quote") {
        setQuoting(false);
        setQuote("");
      }
      router.refresh(); // the feed shows the new repost (or no longer shows it)
    });
  }

  const canSend = !pending && quote.trim().length > 0 && quote.length <= MAX;

  return (
    <span className="sp-likeWrap">
      <button
        type="button"
        className={`pc-pill sp-repostButton${reposted ? " is-reposted" : ""}`}
        onClick={() => run(reposted ? "undo" : "repost")}
        disabled={pending}
        aria-pressed={reposted}
        aria-label={reposted ? text.unrepost : text.repost}
      >
        ↻ {count}
      </button>

      <button
        type="button"
        className="pc-pill sp-quoteButton"
        onClick={() => { setError(""); setQuoting((open) => !open); }}
        disabled={pending}
        aria-expanded={quoting}
      >
        {text.quote}
      </button>

      {error && (
        <span className="sp-likeError" role="status">
          {error}
        </span>
      )}

      {quoting && (
        <span className="oa-form sp-quoteForm">
          <label className="sf-label" htmlFor={`sp-quote-${postId}`}>{text.field}</label>
          <textarea
            id={`sp-quote-${postId}`}
            className="pc-field"
            rows={4}
            maxLength={MAX}
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
          />
          <span className="sp-counter">{quote.length}/{MAX}</span>
          <span className="oa-buttons">
            <button type="button" className="pc-pill pc-pill-sm" disabled={pending} onClick={() => { setQuoting(false); setQuote(""); setError(""); }}>
              {text.cancel}
            </button>
            <button type="button" className="pc-btn pc-btn-sm" disabled={!canSend} onClick={() => run("quote", quote)}>
              {pending ? text.saving : text.submit}
            </button>
          </span>
        </span>
      )}
    </span>
  );
}
