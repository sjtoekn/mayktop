"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { acceptAnswer } from "@/app/(site)/post/[id]/qa-actions";

// All visible text comes in as props (translated on the server).
export type AcceptAnswerText = { accept: string; unaccept: string; error: string };

/**
 * "Accept this answer" under an answer (SITE_PLAN B4). Shown ONLY to the person who asked the question (the server checks again).
 * The page is cached and shared, so who is looking is known only here, from the login session.
 */
export default function AcceptAnswerButton({
  commentId,
  postAuthor,
  commentAuthor,
  accepted,
  text,
}: {
  commentId: number;
  postAuthor: string;
  commentAuthor: string;
  accepted: boolean;
  text: AcceptAnswerText;
}) {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!session || !postAuthor || session.user.username !== postAuthor || commentAuthor === postAuthor) return null;

  function toggle() {
    if (pending) return;
    setFailed(false);
    startTransition(async () => {
      const result = await acceptAnswer({ commentId, accept: !accepted });
      if ("error" in result) {
        setFailed(true);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className="pc-pill pc-pill-sm" onClick={toggle} disabled={pending} aria-pressed={accepted}>
        {accepted ? `✓ ${text.unaccept}` : text.accept}
      </button>
      {failed && <span className="type-small" role="alert">{text.error}</span>}
    </>
  );
}
