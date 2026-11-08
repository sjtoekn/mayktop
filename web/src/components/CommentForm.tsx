"use client";

import { useState, useTransition } from "react";
import LoginNotice from "@/components/LoginNotice";
import { useLoggedOut } from "@/lib/use-logged-out";
import { createComment } from "@/app/(site)/post/[id]/actions";

// All visible text comes in as props (translated on the server with t()).
export type CommentFormText = {
  label: string;
  placeholder: string;
  submit: string;
  saving: string;
  error: string;
  cancel: string;
  login: string; // "Please log in to do this."
  loginLink: string; // "Log in"
};

/** The box for a new comment (no parentId) or a reply (parentId = the comment being answered). */
export default function CommentForm({
  postId,
  parentId,
  text,
  onDone,
  onCancel,
}: {
  postId: number;
  parentId?: number;
  text: CommentFormText;
  onDone?: () => void; // called after the comment was saved
  onCancel?: () => void; // when given, a Cancel button is shown
}) {
  const [body, setBody] = useState("");
  const [failed, setFailed] = useState<false | "error" | "login">(false);
  const [pending, startTransition] = useTransition();
  const loggedOut = useLoggedOut(); // nobody logged in: the box is locked (the server refuses too)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || loggedOut || body.trim().length === 0) return;
    setFailed(false);
    startTransition(async () => {
      const result = await createComment({ postId, parentId, body });
      if ("error" in result) {
        setFailed(result.login ? "login" : "error");
      } else {
        setBody(""); // the page shows the new comment by itself
        onDone?.();
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="pc-composer-main"
      style={parentId !== undefined ? { marginTop: 12 } : undefined}
    >
      <textarea
        aria-label={text.label}
        placeholder={text.placeholder}
        rows={parentId !== undefined ? 2 : 3}
        className="pc-field"
        value={body}
        disabled={loggedOut}
        maxLength={5000}
        onChange={(e) => setBody(e.target.value)}
      />
      {(loggedOut || failed) && (
        <div className="notice notice-danger" role="alert">
          {loggedOut || failed === "login" ? <LoginNotice text={{ message: text.login, link: text.loginLink }} /> : text.error}
        </div>
      )}
      <div className="pc-actions">
        {onCancel && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
            {text.cancel}
          </button>
        )}
        <button
          type="submit"
          className="pc-btn pc-btn-sm"
          disabled={pending || loggedOut || body.trim().length === 0}
        >
          {pending ? text.saving : text.submit}
        </button>
      </div>
    </form>
  );
}
