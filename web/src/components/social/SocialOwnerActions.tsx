"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { deleteSocialPost, editSocialPost } from "@/app/(site)/social/manage/actions";
import "@/app/(site)/manage/owner.css";

// All visible text comes in as props (translated on the server), so this file has no words.
export type SocialOwnerText = {
  edit: string;
  field: string;
  save: string;
  cancel: string;
  saving: string;
  error: string;
  invalid: string;
  tooMany: string; // edit; contains {minutes}
  login: string; // edit
  loginLink: string;
  delete: string;
  deleteConfirm: string;
  deleteYes: string;
  deleteNo: string;
  deleteError: string;
  deleteTooMany: string; // contains {minutes}
  deleteLogin: string;
};

const MAX = 5000;

type Failure = { kind: "error" | "login" | "invalid" | "tooMany"; action: "edit" | "delete" };

/**
 * "Edit post" and "Delete" under a Social post. Shown ONLY to the person who wrote it (the server checks again on
 * every call). Delete asks once more before it erases anything.
 */
export default function SocialOwnerActions({
  id,
  author,
  body: initialBody,
  text,
}: {
  id: number;
  author: string;
  body: string;
  text: SocialOwnerText;
}) {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "edit" | "confirm">("idle");
  const [body, setBody] = useState(initialBody);
  const [failed, setFailed] = useState<Failure | null>(null);
  const [waitMinutes, setWaitMinutes] = useState(1);
  const [pending, startTransition] = useTransition();

  if (!session || !author || session.user.username !== author) return null;

  const trimmed = body.trim();
  const canSave = !pending && trimmed.length > 0 && body.length <= MAX && trimmed !== initialBody.trim();

  function open(next: "edit" | "confirm") {
    setBody(initialBody);
    setFailed(null);
    setMode(next);
  }

  function cancel() {
    if (pending) return;
    setBody(initialBody);
    setFailed(null);
    setMode("idle");
  }

  function save() {
    if (!canSave) return;
    setFailed(null);
    startTransition(async () => {
      const result = await editSocialPost({ id, body });
      if ("error" in result) {
        if (result.tooMany) setWaitMinutes(result.waitMinutes ?? 1);
        setFailed({
          action: "edit",
          kind: result.login ? "login" : result.tooMany ? "tooMany" : result.invalid ? "invalid" : "error",
        });
        return;
      }
      setMode("idle");
      router.refresh();
    });
  }

  function erase() {
    if (pending) return;
    setFailed(null);
    startTransition(async () => {
      const result = await deleteSocialPost({ id });
      if ("error" in result) {
        if (result.tooMany) setWaitMinutes(result.waitMinutes ?? 1);
        setFailed({ action: "delete", kind: result.login ? "login" : result.tooMany ? "tooMany" : "error" });
        return;
      }
      setMode("idle");
      router.refresh();
    });
  }

  function failureMessage(f: Failure) {
    const del = f.action === "delete";
    if (f.kind === "login") {
      return (
        <>
          {del ? text.deleteLogin : text.login} <Link href="/login">{text.loginLink}</Link>
        </>
      );
    }
    if (f.kind === "tooMany") return (del ? text.deleteTooMany : text.tooMany).replace("{minutes}", String(waitMinutes));
    if (f.kind === "invalid") return text.invalid;
    return del ? text.deleteError : text.error;
  }

  return (
    <div className="sp-owner">
      {mode === "idle" && (
        <div className="oa-row">
          <button type="button" className="pc-pill pc-pill-sm" onClick={() => open("edit")}>
            {text.edit}
          </button>
          <button type="button" className="pc-pill pc-pill-sm" onClick={() => open("confirm")}>
            {text.delete}
          </button>
        </div>
      )}

      {mode === "confirm" && (
        <div className="oa-form">
          <p className="oa-confirm" role="alert">{text.deleteConfirm}</p>
          <div className="oa-buttons">
            <button type="button" className="pc-pill pc-pill-sm" disabled={pending} onClick={cancel}>
              {text.deleteNo}
            </button>
            <button type="button" className="pc-btn pc-btn-sm" disabled={pending} onClick={erase}>
              {pending ? text.saving : text.deleteYes}
            </button>
          </div>
        </div>
      )}

      {mode === "edit" && (
        <div className="oa-form">
          <label className="sf-label" htmlFor={`sp-edit-${id}`}>{text.field}</label>
          <textarea
            id={`sp-edit-${id}`}
            className="pc-field"
            rows={5}
            maxLength={MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="sp-counter">{body.length}/{MAX}</div>
          <div className="oa-buttons">
            <button type="button" className="pc-pill pc-pill-sm" disabled={pending} onClick={cancel}>
              {text.cancel}
            </button>
            <button type="button" className="pc-btn pc-btn-sm" disabled={!canSave} onClick={save}>
              {pending ? text.saving : text.save}
            </button>
          </div>
        </div>
      )}

      {failed && (
        <div className="notice notice-danger" role="alert">{failureMessage(failed)}</div>
      )}
    </div>
  );
}
