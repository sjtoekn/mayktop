"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitContentAppeal } from "@/app/(site)/appeal/actions";

// The appeal box for a removed post / comment (TODO 40). All visible text comes in as props (translated on the server).
export type ContentAppealText = {
  message: string;
  submit: string;
  working: string;
  sent: string;
  errorShort: string;
  errorWindow: string;
  errorExists: string;
  errorGeneric: string;
};

export default function ContentAppealForm({ kind, id, text }: { kind: "post" | "comment"; id: number; text: ContentAppealText }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await submitContentAppeal({ kind, id, message });
      if ("error" in result) {
        setError(
          result.error === "short" ? text.errorShort
            : result.error === "window" ? text.errorWindow
              : result.error === "exists" ? text.errorExists
                : text.errorGeneric,
        );
        return;
      }
      setSent(true);
      router.refresh();
    });
  }

  if (sent) return <div className="notice notice-success" role="status">{text.sent}</div>;

  return (
    <form onSubmit={onSubmit} className="st-delete">
      <label className="sf-label" htmlFor="appeal-message">{text.message}</label>
      <textarea
        id="appeal-message"
        className="pc-field"
        rows={6}
        value={message}
        maxLength={2000}
        required
        onChange={(e) => setMessage(e.target.value)}
      />
      {error && <div className="notice notice-danger" role="alert">{error}</div>}
      <div className="st-delete-actions">
        <button type="submit" className="pc-btn pc-btn-sm" disabled={pending || message.trim().length === 0}>
          {pending ? text.working : text.submit}
        </button>
      </div>
    </form>
  );
}
