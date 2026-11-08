"use client";
// Accept / Reject box under one open appeal (admin Part 6): written note -> "are you sure" -> done.
// All visible text comes in as props (translated on the server). The rules are enforced again in appeals.ts.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { appealDecision } from "@/app/admin/appeals/actions";

export type AppealDecisionText = {
  note: string; // label, with {min}
  accept: string;
  reject: string;
  sureAcceptContent: string;
  sureAcceptAccount: string;
  sureAcceptAd: string;
  sureReject: string;
  back: string;
  working: string;
  done: string;
  errors: Record<string, string>; // by appeal error code, plus "other"
};

type Props = {
  appealId: number;
  kind: "content" | "account" | "ad";
  limits: { minReason: number; maxReason: number };
  text: AppealDecisionText;
};

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in params ? String(params[key]) : whole));
}

export default function AppealDecision({ appealId, kind, limits, text }: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [choice, setChoice] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const message = (code: string) => fill(text.errors[code] ?? text.errors.other, { min: limits.minReason, max: limits.maxReason });

  function pick(which: "accept" | "reject") {
    const length = note.trim().length;
    if (length < limits.minReason || length > limits.maxReason) return setError(message("message"));
    setError(null);
    setChoice(which);
  }

  function confirm() {
    if (!choice || pending) return;
    const accept = choice === "accept";
    startTransition(async () => {
      const result = await appealDecision({ appealId, accept, note });
      if ("error" in result) {
        setError(message(result.error));
        setChoice(null);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  if (done) return <div className="notice notice-success" role="status">{text.done}</div>;

  if (choice) {
    const sure = choice === "reject" ? text.sureReject : kind === "account" ? text.sureAcceptAccount : kind === "ad" ? text.sureAcceptAd : text.sureAcceptContent;
    return (
      <div className="ad-form">
        <p className="ad-sure">{sure}</p>
        <div className="ad-actionRow">
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={pending}>
            {pending ? text.working : choice === "accept" ? text.accept : text.reject}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setChoice(null)} disabled={pending}>{text.back}</button>
        </div>
      </div>
    );
  }

  const field = `ad-appeal-note-${appealId}`;
  return (
    <div className="ad-form">
      <label className="sf-label" htmlFor={field}>{fill(text.note, { min: limits.minReason })}</label>
      <textarea id={field} className="pc-field" rows={3} maxLength={limits.maxReason} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <div className="notice notice-danger" role="alert">{error}</div>}
      <div className="ad-actionRow">
        <button type="button" className="btn btn-secondary" onClick={() => pick("accept")}>{text.accept}</button>
        <button type="button" className="btn btn-secondary" onClick={() => pick("reject")}>{text.reject}</button>
      </div>
    </div>
  );
}
