"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { deleteComment, deletePost, editComment, editPost } from "@/app/(site)/manage/actions";
import "@/app/(site)/manage/owner.css";

// All visible text comes in as props (translated on the server), so this file has no words.
export type OwnerText = {
  edit: string;
  delete: string;
  save: string;
  cancel: string;
  saving: string;
  confirm: string;
  confirmYes: string;
  confirmNo: string;
  error: string;
  fieldTitle: string;
  fieldBody: string;
};

/**
 * "Edit" and "Delete" under a post (kind "post", has a title) or a comment (kind "comment").
 * Shown ONLY to the person who wrote it (the server checks again on every save). Delete asks
 * once more before it erases anything.
 */
export default function OwnerActions({
  kind,
  id,
  author,
  title: initialTitle = "",
  body: initialBody,
  text,
}: {
  kind: "post" | "comment";
  id: number;
  author: string;
  title?: string;
  body: string;
  text: OwnerText;
}) {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "edit" | "confirm">("idle");
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!session || !author || session.user.username !== author) return null;

  function run(action: () => Promise<{ ok: true } | { error: true }>) {
    if (pending) return;
    setError(false);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        setError(true);
        return;
      }
      setMode("idle");
      router.refresh();
    });
  }

  function cancel() {
    setTitle(initialTitle);
    setBody(initialBody);
    setError(false);
    setMode("idle");
  }

  const save = () =>
    run(() => (kind === "post" ? editPost({ id, title, body }) : editComment({ id, text: body })));
  const erase = () => run(() => (kind === "post" ? deletePost({ id }) : deleteComment({ id })));

  return (
    <div>
      {mode === "idle" && (
        <div className="oa-row">
          <button type="button" className="pc-pill pc-pill-sm" onClick={() => setMode("edit")}>
            {text.edit}
          </button>
          <button type="button" className="pc-pill pc-pill-sm" onClick={() => setMode("confirm")}>
            {text.delete}
          </button>
        </div>
      )}

      {mode === "confirm" && (
        <div className="oa-form">
          <p className="oa-confirm" role="alert">{text.confirm}</p>
          <div className="oa-buttons">
            <button type="button" className="pc-pill pc-pill-sm" disabled={pending} onClick={cancel}>
              {text.confirmNo}
            </button>
            <button type="button" className="pc-btn pc-btn-sm" disabled={pending} onClick={erase}>
              {pending ? text.saving : text.confirmYes}
            </button>
          </div>
        </div>
      )}

      {mode === "edit" && (
        <div className="oa-form">
          {kind === "post" && (
            <>
              <label className="sf-label" htmlFor={`oa-title-${kind}-${id}`}>{text.fieldTitle}</label>
              <input
                id={`oa-title-${kind}-${id}`}
                className="pc-field"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
              />
            </>
          )}
          <label className="sf-label" htmlFor={`oa-body-${kind}-${id}`}>{text.fieldBody}</label>
          <textarea
            id={`oa-body-${kind}-${id}`}
            className="pc-field"
            value={body}
            maxLength={kind === "post" ? 10000 : 5000}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="oa-buttons">
            <button type="button" className="pc-pill pc-pill-sm" disabled={pending} onClick={cancel}>
              {text.cancel}
            </button>
            <button
              type="button"
              className="pc-btn pc-btn-sm"
              disabled={pending || body.trim().length === 0 || (kind === "post" && title.trim().length === 0)}
              onClick={save}
            >
              {pending ? text.saving : text.save}
            </button>
          </div>
        </div>
      )}

      {error && <div className="notice notice-danger" role="alert">{text.error}</div>}
    </div>
  );
}
