"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitAppeal } from "@/app/(site)/settings/appeal/actions";

// The appeal box on /settings for a suspended or banned person (TODO 36d).
// All visible text comes in as props (translated on the server).
export type AppealText = {
  message: string;
  submit: string;
  working: string;
  sent: string;
  errorShort: string;
  errorGeneric: string;
};

export default function AppealForm({ text }: { text: AppealText }) {
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
      const result = await submitAppeal({ message });
      if ("error" in result) {
        setError(result.error === "short" ? text.errorShort : text.errorGeneric);
        return;
      }
      setSent(true);
      router.refresh();
    });
  }

  if (sent) return <div className="notice notice-success" role="status">{text.sent}</div>;

  return (
    <form onSubmit={onSubmit} className="st-delete">
      <label className="sf-label" htmlFor="st-appeal-message">{text.message}</label>
      <textarea
        id="st-appeal-message"
        className="pc-field"
        rows={5}
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
