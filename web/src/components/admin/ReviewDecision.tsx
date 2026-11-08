"use client";
// Restore / Remove box under one hidden post or comment (admin Part 4): written note -> "are you sure" -> done.
// All visible text comes in as props (translated on the server). The rules are enforced again in review.ts.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewDecision } from "@/app/admin/review/actions";

export type ReviewDecisionText = {
  note: string; // label, with {min}
  restore: string;
  remove: string;
  sureRestore: string;
  sureRemove: string;
  back: string;
  working: string;
  done: string;
  errors: Record<string, string>; // by review error code, plus "other"
};

type Props = {
  kind: "post" | "comment";
  id: number;
  limits: { minReason: number; maxReason: number };
  text: ReviewDecisionText;
};

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in params ? String(params[key]) : whole));
}

export default function ReviewDecision({ kind, id, limits, text }: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [choice, setChoice] = useState<"restore" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const message = (code: string) => fill(text.errors[code] ?? text.errors.other, { min: limits.minReason, max: limits.maxReason });

  function pick(which: "restore" | "remove") {
    const length = note.trim().length;
    if (length < limits.minReason || length > limits.maxReason) return setError(message("reason"));
    setError(null);
    setChoice(which);
  }

  function confirm() {
    if (!choice || pending) return;
    const restore = choice === "restore";
    startTransition(async () => {
      const result = await reviewDecision({ kind, id, restore, note });
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
    return (
      <div className="ad-form">
        <p className="ad-sure">{choice === "restore" ? text.sureRestore : text.sureRemove}</p>
        <div className="ad-actionRow">
          <button type="button" className={`btn ${choice === "remove" ? "btn-danger" : "btn-primary"}`} onClick={confirm} disabled={pending}>
            {pending ? text.working : choice === "remove" ? text.remove : text.restore}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setChoice(null)} disabled={pending}>{text.back}</button>
        </div>
      </div>
    );
  }

  const field = `ad-review-note-${kind}-${id}`;
  return (
    <div className="ad-form">
      <label className="sf-label" htmlFor={field}>{fill(text.note, { min: limits.minReason })}</label>
      <textarea id={field} className="pc-field" rows={3} maxLength={limits.maxReason} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <div className="notice notice-danger" role="alert">{error}</div>}
      <div className="ad-actionRow">
        <button type="button" className="btn btn-secondary" onClick={() => pick("restore")}>{text.restore}</button>
        <button type="button" className="btn btn-secondary" onClick={() => pick("remove")}>{text.remove}</button>
      </div>
    </div>
  );
}
