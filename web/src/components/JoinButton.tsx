"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import LoginNotice, { type LoginText } from "@/components/LoginNotice";
import { getMyMembership, setMembership } from "@/app/(site)/c/[slug]/actions";

// All visible text comes in as props (translated on the server), so this file has no words.
export type JoinText = {
  join: string;
  leave: string;
  error: string;
  moderator: string;
  login: LoginText;
};

/**
 * The Join / Leave button of a community page.
 * The page is cached and shared, so whether YOU are a member is asked after it opens
 * (only when logged in). Not logged in: the button shows "Join" and a click only shows a
 * "Please log in" note. The member count is refreshed from the server after every change.
 */
export default function JoinButton({ slug, text }: { slug: string; text: JoinText }) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const router = useRouter();
  const [state, setState] = useState<{ userId: string | null; member: boolean } | null>(null);
  const [note, setNote] = useState<"" | "error" | "login" | "moderator">("");
  const [pending, startTransition] = useTransition();

  // Ask once per person whether they are a member (again after log in / log out).
  useEffect(() => {
    if (sessionPending || !userId) return;
    let ignore = false;
    getMyMembership(slug)
      .then((r) => {
        if (!ignore) setState({ userId, member: r.member });
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [slug, userId, sessionPending]);

  const member = !!userId && state?.userId === userId && state.member;
  const known = !userId || state?.userId === userId; // false while the answer is on its way

  function click() {
    if (pending || !known) return;
    if (!userId) {
      setNote("login");
      return;
    }
    setNote("");
    startTransition(async () => {
      const result = await setMembership({ slug, join: !member });
      if ("error" in result) {
        setNote(result.login ? "login" : result.moderator ? "moderator" : "error");
        return;
      }
      setState({ userId, member: result.member });
      router.refresh(); // new member count
    });
  }

  return (
    <div className="pc-join">
      <button
        type="button"
        className={member ? "pc-btn pc-btn-ghost" : "pc-btn"}
        aria-pressed={member}
        disabled={pending || !known}
        onClick={click}
      >
        {member ? text.leave : text.join}
      </button>
      {note && (
        <span className="type-small pc-join-note" role="alert">
          {note === "login" ? (
            <LoginNotice text={text.login} />
          ) : note === "moderator" ? (
            text.moderator
          ) : (
            text.error
          )}
        </span>
      )}
    </div>
  );
}
