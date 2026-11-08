"use client";
// Approve / reject box under one ban proposal (admin Part 3): written note -> "are you sure" -> done.
// All visible text comes in as props (translated on the server). The rules are enforced again in staff.ts.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { banDecision } from "@/app/admin/bans/actions";

export type BanDecisionText = {
  note: string; // label, with {min}
  approve: string;
  reject: string;
  sureApprove: string; // with {name} and {days}
  sureReject: string; // with {name}
  back: string;
  working: string;
  done: string;
  errors: Record<string, string>; // by staff error code, plus "other"
};

type Props = {
  proposalId: number;
  name: string;
  own: boolean; // the proposer: may only withdraw (reject)
  limits: { minReason: number; maxReason: number };
  graceDays: number;
  text: BanDecisionText;
};

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in params ? String(params[key]) : whole));
}

export default function BanDecision({ proposalId, name, own, limits, graceDays, text }: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [choice, setChoice] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const message = (code: string) => fill(text.errors[code] ?? text.errors.other, { min: limits.minReason, max: limits.maxReason });

  function pick(which: "approve" | "reject") {
    const length = note.trim().length;
    if (length < limits.minReason || length > limits.maxReason) return setError(message("reason"));
    setError(null);
    setChoice(which);
  }

  function confirm() {
    if (!choice || pending) return;
    const approve = choice === "approve";
    startTransition(async () => {
      const result = await banDecision({ proposalId, approve, note });
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
        <p className="ad-sure">
          {choice === "approve" ? fill(text.sureApprove, { name, days: graceDays }) : fill(text.sureReject, { name })}
        </p>
        <div className="ad-actionRow">
          <button type="button" className={`btn ${choice === "approve" ? "btn-danger" : "btn-primary"}`} onClick={confirm} disabled={pending}>
            {pending ? text.working : choice === "approve" ? text.approve : text.reject}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setChoice(null)} disabled={pending}>{text.back}</button>
        </div>
      </div>
    );
  }

  const id = `ad-ban-note-${proposalId}`;
  return (
    <div className="ad-form">
      <label className="sf-label" htmlFor={id}>{fill(text.note, { min: limits.minReason })}</label>
      <textarea id={id} className="pc-field" rows={3} maxLength={limits.maxReason} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <div className="notice notice-danger" role="alert">{error}</div>}
      <div className="ad-actionRow">
        {!own && <button type="button" className="btn btn-primary" onClick={() => pick("approve")}>{text.approve}</button>}
        <button type="button" className="btn btn-secondary" onClick={() => pick("reject")}>{text.reject}</button>
      </div>
    </div>
  );
}
