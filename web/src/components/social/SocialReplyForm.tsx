"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSocialReply } from "@/app/(site)/social/reply/actions";
import "@/app/(site)/manage/owner.css";

// All visible text comes in as props (translated on the server), so this file has no words.
export type SocialReplyFormText = {
  field: string; // label of the text box
  submit: string;
  saving: string;
  login: string;
  tooMany: string; // contains {minutes}
  duplicate: string; // the same reply was already sent recently (SOCIAL_TODO C2)
  invalid: string;
  restricted: string; // the author of the post limited who can reply (SOCIAL_TODO B9)
  error: string;
};

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in params ? String(params[key]) : whole));
}

/** The reply box under a Social post. The server checks everything again; the person comes from the login cookie. */
export default function SocialReplyForm({ postId, max, text }: { postId: number; max: number; text: SocialReplyFormText }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const canSend = !pending && body.trim().length > 0 && body.length <= max;

  function send() {
    if (!canSend) return;
    setError("");
    startTransition(async () => {
      const result = await createSocialReply({ postId, body });
      if ("error" in result) {
        setError(
          result.login ? text.login
            : result.tooMany ? fill(text.tooMany, { minutes: result.waitMinutes ?? 1 })
            : result.duplicate ? text.duplicate
            : result.invalid ? text.invalid
            : result.restricted ? text.restricted
            : text.error,
        );
        return;
      }
      setBody("");
      router.refresh(); // the new reply shows in the list
    });
  }

  return (
    <div className="oa-form sp-replyForm">
      <label className="sf-label" htmlFor={`sp-reply-${postId}`}>{text.field}</label>
      <textarea
        id={`sp-reply-${postId}`}
        className="pc-field"
        rows={3}
        maxLength={max}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <span className="sp-counter">{body.length}/{max}</span>
      {error && <span className="sp-likeError" role="alert">{error}</span>}
      <span className="oa-buttons">
        <button type="button" className="pc-btn pc-btn-sm" disabled={!canSend} onClick={send}>
          {pending ? text.saving : text.submit}
        </button>
      </span>
    </div>
  );
}
