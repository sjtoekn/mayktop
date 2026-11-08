"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  keepMyAccount,
  requestAccountDeletion,
  type DeleteErrorCode,
} from "@/app/(site)/settings/delete/actions";

// "Delete your account" on /settings (TODO 36c). All visible text comes in as props (translated on
// the server), so this file has no words.
//   mode "request": a button opens a password box; confirming schedules the deletion and logs out.
//   mode "pending": the deletion is already scheduled; one button cancels it.
export type DeleteText = {
  start: string;
  password: string;
  submit: string;
  back: string;
  done: string; // contains {time}
  keep: string;
  working: string;
  errors: Record<DeleteErrorCode, string>;
  keepError: string;
};

export default function DeleteAccountForm({
  mode,
  text,
}: {
  mode: "request" | "pending";
  text: DeleteText;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [doneWhen, setDoneWhen] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onDelete(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await requestAccountDeletion({ password });
      setPassword("");
      if ("error" in result) {
        setError(text.errors[result.error]);
        if (result.error === "state") router.refresh();
        return;
      }
      // The server logged the other devices out; this one is logged out here, like the top-bar button.
      // No router.refresh() on success: with nobody logged in, /settings would jump to /login and
      // the person would never read the date.
      try {
        await authClient.signOut();
        setDoneWhen(result.when);
      } catch {
        // Still logged in: the page now shows "scheduled for deletion" with the Keep button.
        router.refresh();
      }
    });
  }

  function onKeep() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await keepMyAccount();
      if ("error" in result) setError(text.keepError);
      router.refresh();
    });
  }

  if (doneWhen) {
    return (
      <div className="notice notice-info" role="status">
        {text.done.replace("{time}", doneWhen)}
      </div>
    );
  }

  if (mode === "pending") {
    return (
      <>
        {error && <div className="notice notice-danger" role="alert">{error}</div>}
        <div>
          <button type="button" className="pc-btn pc-btn-sm" disabled={pending} onClick={onKeep}>
            {pending ? text.working : text.keep}
          </button>
        </div>
      </>
    );
  }

  if (!open) {
    return (
      <div>
        <button type="button" className="pc-btn pc-btn-sm pc-btn-danger" onClick={() => setOpen(true)}>
          {text.start}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onDelete} className="st-delete">
      <label className="sf-label" htmlFor="st-del-password">{text.password}</label>
      <input
        id="st-del-password"
        type="password"
        className="pc-field"
        value={password}
        maxLength={128}
        autoComplete="current-password"
        required
        autoFocus
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <div className="notice notice-danger" role="alert">{error}</div>}
      <div className="st-delete-actions">
        <button type="submit" className="pc-btn pc-btn-sm pc-btn-danger" disabled={pending || password.length === 0}>
          {pending ? text.working : text.submit}
        </button>
        <button
          type="button"
          className="pc-btn pc-btn-sm pc-btn-ghost"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setPassword("");
            setError(null);
          }}
        >
          {text.back}
        </button>
      </div>
    </form>
  );
}
