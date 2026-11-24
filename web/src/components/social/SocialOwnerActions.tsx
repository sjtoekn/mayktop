"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { nowMs } from "@/lib/now";
import { socialEdit } from "@/config/site";
import { editsLeft, editWindowEndsAtMs } from "@/lib/social-edit-rules";
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
  link: string; // edit: a web link needs reputation (reputationConfig.privileges.link)
  tooMany: string; // edit; contains {minutes}
  login: string; // edit
  loginLink: string;
  windowClosed: string; // edit: the edit time is over
  limitReached: string; // edit: all allowed edits are used
  hint: string; // edit form; contains {left}
  delete: string;
  deleteConfirm: string;
  deleteYes: string;
  deleteNo: string;
  deleteError: string;
  deleteTooMany: string; // contains {minutes}
  deleteLogin: string;
};

const MAX = 5000;

type Failure = { kind: "error" | "login" | "invalid" | "link" | "tooMany" | "window" | "limit"; action: "edit" | "delete" };

/**
 * "Edit post" and "Delete" under a Social post. Shown ONLY to the person who wrote it (the server checks again on
 * every call). Delete asks once more before it erases anything.
 */
export default function SocialOwnerActions({
  id,
  author,
  body: initialBody,
  createdAtMs,
  editCount,
  text,
}: {
  id: number;
  author: string;
  body: string;
  /** When the post was written: the edit window counts from here (it does not restart with an edit). */
  createdAtMs: number;
  /** How many times the post was already edited (earlier versions saved). */
  editCount: number;
  text: SocialOwnerText;
}) {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "edit" | "confirm">("idle");
  const [body, setBody] = useState(initialBody);
  const [failed, setFailed] = useState<Failure | null>(null);
  const [waitMinutes, setWaitMinutes] = useState(1);
  const [pending, startTransition] = useTransition();
  const [now] = useState(() => nowMs()); // read once when the box appears; the server checks the time again on every save
  const [locked, setLocked] = useState<"window" | "limit" | null>(null); // the server said no: stop offering Edit

  if (!session || !author || session.user.username !== author) return null;

  const left = editsLeft(editCount, socialEdit);
  const closed: "window" | "limit" | null =
    locked ?? (now > editWindowEndsAtMs(createdAtMs, socialEdit) ? "window" : left <= 0 ? "limit" : null);
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
        if (result.windowClosed || result.limitReached) {
          setLocked(result.windowClosed ? "window" : "limit");
          setMode("idle");
          setFailed(null);
          return;
        }
        setFailed({
          action: "edit",
          kind: result.login ? "login" : result.tooMany ? "tooMany" : result.invalid ? "invalid" : result.link ? "link" : "error",
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
    if (f.kind === "link") return text.link;
    if (f.kind === "window") return text.windowClosed;
    if (f.kind === "limit") return text.limitReached;
    return del ? text.deleteError : text.error;
  }

  return (
    <div className="sp-owner">
      {mode === "idle" && (
        <div className="oa-row">
          {!closed && (
            <button type="button" className="pc-pill pc-pill-sm" onClick={() => open("edit")}>
              {text.edit}
            </button>
          )}
          <button type="button" className="pc-pill pc-pill-sm" onClick={() => open("confirm")}>
            {text.delete}
          </button>
        </div>
      )}

      {mode === "idle" && closed && (
        <p className="pc-meta" role="status">{closed === "window" ? text.windowClosed : text.limitReached}</p>
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
          <p className="pc-meta">{text.hint.replace("{left}", String(left))}</p>
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
