"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset, resetPassword } from "@/app/(site)/auth/actions";

// All visible text comes in as props (translated on the server), so this file has no words.
export type ResetText = {
  forgotTitle: string;
  forgotBody: string;
  forgotSubmit: string;
  sentTitle: string;
  sentBody: string;
  resetTitle: string;
  resetSubmit: string;
  doneTitle: string;
  doneBody: string;
  email: string;
  newPassword: string;
  working: string;
  backToLogin: string;
  errors: { generic: string; passwordShort: string; invalidToken: string };
};

/**
 * mode "request": ask for the email, then show "check your email".
 * mode "reset":   choose the new password (needs the token from the emailed link), then show "done".
 */
export default function PasswordResetForm({
  mode,
  token,
  text,
}: {
  mode: "request" | "reset";
  token?: string;
  text: ResetText;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<keyof ResetText["errors"] | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const reset = mode === "reset";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = reset
        ? await resetPassword({ token: token ?? "", password })
        : await requestPasswordReset({ email });
      if ("error" in result) setError(result.error);
      else setDone(true);
    });
  }

  if (done) {
    return (
      <div className="sf-wrap">
        <section className="card sf-card" role="status">
          <h1 className="sf-h1">{reset ? text.doneTitle : text.sentTitle}</h1>
          <p>{reset ? text.doneBody : text.sentBody}</p>
          <div className="pc-actions">
            <Link href="/login" className="pc-btn">{text.backToLogin}</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="sf-wrap">
      <section className="card sf-card">
        <h1 className="sf-h1">{reset ? text.resetTitle : text.forgotTitle}</h1>
        {!reset && <p>{text.forgotBody}</p>}

        {reset ? (
          <>
            <label className="sf-label" htmlFor="pr-password">{text.newPassword}</label>
            <input
              id="pr-password"
              type="password"
              className="pc-field"
              value={password}
              maxLength={128}
              minLength={8}
              autoComplete="new-password"
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </>
        ) : (
          <>
            <label className="sf-label" htmlFor="pr-email">{text.email}</label>
            <input
              id="pr-email"
              type="email"
              className="pc-field"
              value={email}
              maxLength={254}
              autoComplete="email"
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </>
        )}

        {error && <div className="notice notice-danger" role="alert">{text.errors[error]}</div>}

        <div className="pc-actions">
          <button type="submit" className="pc-btn" disabled={pending}>
            {pending ? text.working : reset ? text.resetSubmit : text.forgotSubmit}
          </button>
        </div>

        <p className="type-small">
          <Link href="/login">{text.backToLogin}</Link>
        </p>
      </section>
    </form>
  );
}
