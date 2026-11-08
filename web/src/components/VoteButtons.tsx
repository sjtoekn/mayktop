"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import Icon from "@/components/shell/Icon";
import LoginNotice, { type LoginText } from "@/components/LoginNotice";
import { useMyVotes, type MyVote } from "@/components/MyVotesProvider";
import { castVote } from "@/app/(site)/vote/actions";

/**
 * The up arrow, the vote total and the down arrow for a post or a comment.
 * The number changes at once (optimistic) and is replaced by the saved total when the server
 * answers; if saving fails the old number comes back and a short message is shown.
 * The highlighted arrow (the logged-in person's own vote) is not part of the cached page: it
 * comes from <MyVotesProvider>. Not logged in: the click is refused and a "Log in" note appears.
 * All visible text and the language come in as props (translated on the server).
 */
export default function VoteButtons({
  target,
  id,
  votes,
  locale,
  upLabel,
  downLabel,
  errorText,
  loginText,
  disabled = false,
  small = false,
}: {
  target: "post" | "comment";
  id: number;
  votes: number;
  locale: string;
  upLabel: string;
  downLabel: string;
  errorText: string;
  loginText: LoginText;
  disabled?: boolean;
  small?: boolean;
}) {
  const { get, set, register } = useMyVotes();
  const myVote: MyVote = get(target, id);
  useEffect(() => register(target, id), [register, target, id]);
  const [state, setOptimistic] = useOptimistic(
    { votes, myVote },
    (current: { votes: number; myVote: MyVote }, clicked: 1 | -1) => {
      const next: MyVote = current.myVote === clicked ? 0 : clicked; // same arrow again = take back
      return { votes: current.votes - current.myVote + next, myVote: next };
    },
  );
  const [failed, setFailed] = useState<false | "error" | "login">(false);
  const [pending, startTransition] = useTransition();

  function click(value: 1 | -1) {
    if (disabled || pending) return;
    setFailed(false);
    startTransition(async () => {
      setOptimistic(value);
      const result = await castVote({ target, id, value });
      if ("error" in result) {
        setFailed(result.login ? "login" : "error"); // the optimistic number goes back by itself
      } else {
        set(target, id, result.myVote); // keep the arrow highlighted after the page refreshes
      }
    });
  }

  return (
    <>
      <span className={small ? "pc-pill pc-pill-sm" : "pc-pill"}>
        <button
          type="button"
          aria-label={upLabel}
          aria-pressed={state.myVote === 1}
          disabled={disabled}
          className="pc-vote"
          onClick={() => click(1)}
        >
          <Icon name="up" size={small ? 16 : 20} />
        </button>
        {new Intl.NumberFormat(locale).format(state.votes)}
        <button
          type="button"
          aria-label={downLabel}
          aria-pressed={state.myVote === -1}
          disabled={disabled}
          className="pc-vote"
          onClick={() => click(-1)}
        >
          <Icon name="down" size={small ? 16 : 20} />
        </button>
      </span>
      {failed && (
        <span className="type-small" role="alert" style={{ color: "var(--danger)" }}>
          {failed === "login" ? <LoginNotice text={loginText} /> : errorText}
        </span>
      )}
    </>
  );
}
