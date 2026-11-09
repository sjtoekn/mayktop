"use client";

import { useState, useTransition } from "react";
import { changeMyEmail, type EmailErrorCode } from "@/app/(site)/settings/security/actions";

// "Change your email" form (patch-profile-security). All visible text comes in as props.
export type ChangeEmailText = {
  newEmail: string;
  password: string;
  submit: string;
  working: string;
  sent: string;
  errors: Record<EmailErrorCode, string>;
};

export default function ChangeEmailForm({ text, maxLength }: { text: ChangeEmailText; maxLength: number }) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ kind: "sent" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setMessage(null);
    startTransition(async () => {
      const result = await changeMyEmail({ newEmail, password });
      setPassword("");
      if ("error" in result) {
        setMessage({ kind: "error", text: text.errors[result.error] });
        return;
      }
      setNewEmail("");
      setMessage({ kind: "sent", text: text.sent });
    });
  }

  return (
    <form onSubmit={onSubmit} className="ps-form">
      <label className="sf-label" htmlFor="ps-em-new">{text.newEmail}</label>
      <input id="ps-em-new" type="email" className="pc-field" value={newEmail} maxLength={maxLength} autoComplete="email" required onChange={(e) => setNewEmail(e.target.value)} />

      <label className="sf-label" htmlFor="ps-em-password">{text.password}</label>
      <input id="ps-em-password" type="password" className="pc-field" value={password} maxLength={128} autoComplete="current-password" required onChange={(e) => setPassword(e.target.value)} />

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
