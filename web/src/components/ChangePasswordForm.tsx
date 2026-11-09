"use client";

import { useState, useTransition } from "react";
import { changeMyPassword, type PasswordErrorCode } from "@/app/(site)/settings/security/actions";

// "Change your password" form (patch-profile-security). All visible text comes in as props.
export type ChangePasswordText = {
  current: string;
  next: string;
  confirm: string;
  submit: string;
  working: string;
  done: string;
  mismatch: string;
  errors: Record<PasswordErrorCode, string>;
};

export default function ChangePasswordForm({ text, minLength, maxLength }: { text: ChangePasswordText; minLength: number; maxLength: number }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ kind: "done" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setMessage(null);
    if (next !== confirm) {
      setMessage({ kind: "error", text: text.mismatch });
      return;
    }
    startTransition(async () => {
      const result = await changeMyPassword({ current, next });
      if ("error" in result) {
        setMessage({ kind: "error", text: text.errors[result.error] });
        if (result.error !== "wrong") setCurrent("");
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setMessage({ kind: "done", text: text.done });
    });
  }

  return (
    <form onSubmit={onSubmit} className="ps-form">
      <label className="sf-label" htmlFor="ps-pw-current">{text.current}</label>
      <input id="ps-pw-current" type="password" className="pc-field" value={current} maxLength={maxLength} autoComplete="current-password" required onChange={(e) => setCurrent(e.target.value)} />

      <label className="sf-label" htmlFor="ps-pw-new">{text.next}</label>
      <input id="ps-pw-new" type="password" className="pc-field" value={next} minLength={minLength} maxLength={maxLength} autoComplete="new-password" required onChange={(e) => setNext(e.target.value)} />

      <label className="sf-label" htmlFor="ps-pw-confirm">{text.confirm}</label>
      <input id="ps-pw-confirm" type="password" className="pc-field" value={confirm} minLength={minLength} maxLength={maxLength} autoComplete="new-password" required onChange={(e) => setConfirm(e.target.value)} />

      <div className="ps-actions">
        <button type="submit" className="pc-btn pc-btn-sm" disabled={pending}>
          {pending ? text.working : text.submit}
        </button>
        {message && (
          <span className={message.kind === "error" ? "notice notice-danger" : "notice notice-info"} role={message.kind === "error" ? "alert" : "status"}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
