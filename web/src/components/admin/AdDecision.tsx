"use client";
// The buttons under one ad on the admin Ads screen (Part 8): Approve, Reject, Mark as paid, Pause, Restore.
// Every step: fill in (rule + written reason where needed) -> "are you sure" -> done.
// All visible text comes in as props (translated on the server). The rules are enforced again in ad-review.ts.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adAction } from "@/app/admin/ads/actions";

type Kind = "approve" | "reject" | "paid" | "pause" | "restore";

export type AdDecisionText = {
  buttons: Record<Kind, string>;
  notes: Record<Kind, string>; // one line under the form
  sure: Record<Kind, string>; // the "are you sure" question, with {id}
  rule: string; // label of the rule list
  reason: string; // label, with {min}
  continue: string;
  back: string;
  cancel: string;
  working: string;
  done: string;
  errors: Record<string, string>; // by ad error code, plus "other"; may contain {min} {max}
};

type Props = {
  adId: number;
  actions: Kind[];
  rules: { key: string; label: string }[];
  limits: { minReason: number; maxReason: number };
  text: AdDecisionText;
};

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in params ? String(params[key]) : whole));
}

const NEEDS_REASON: Kind[] = ["reject", "pause", "restore"];
const DESTRUCTIVE: Kind[] = ["reject", "pause"];

export default function AdDecision({ adId, actions, rules, limits, text }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<Kind | null>(null);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [rule, setRule] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const message = (code: string) => fill(text.errors[code] ?? text.errors.other, { min: limits.minReason, max: limits.maxReason });

  function start(kind: Kind) {
    setOpen(kind);
    setStep(kind === "approve" || kind === "paid" ? "confirm" : "form"); // nothing to write for these two
    setRule("");
    setReason("");
    setError(null);
    setDone(false);
  }

  function close() {
    setOpen(null);
    setStep("form");
    setError(null);
  }

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (!open) return;
    if (open === "reject" && !rules.some((r) => r.key === rule)) return setError(message("rule"));
    if (NEEDS_REASON.includes(open)) {
      const length = reason.trim().length;
      if (length < limits.minReason || length > limits.maxReason) return setError(message("reason"));
    }
    setError(null);
    setStep("confirm");
  }

  function confirm() {
    if (!open || pending) return;
    const kind = open;
    startTransition(async () => {
      const result = await adAction({
        adId,
        kind,
        rule: kind === "reject" ? rule : undefined,
        reason: NEEDS_REASON.includes(kind) ? reason : undefined,
      });
      if ("error" in result) {
        setError(message(result.error));
        setStep(NEEDS_REASON.includes(kind) ? "form" : "confirm");
        return;
      }
      setOpen(null);
      setDone(true);
      router.refresh();
    });
  }

  if (done) return <div className="notice notice-success" role="status">{text.done}</div>;
  if (actions.length === 0) return null;

  const id = `ad-${adId}`;
  return (
    <div className="ad-form">
      {!open && (
        <div className="ad-actionRow">
          {actions.map((kind, i) => (
            <button key={kind} type="button" className={`btn ${i === 0 && kind !== "pause" ? "btn-primary" : "btn-secondary"}`} onClick={() => start(kind)}>
              {text.buttons[kind]}
            </button>
          ))}
        </div>
      )}

      {open && step === "form" && (
        <form className="ad-form" onSubmit={next}>
          {open === "reject" && (
            <>
              <label className="sf-label" htmlFor={`${id}-rule`}>{text.rule}</label>
              <select id={`${id}-rule`} className="pc-field" value={rule} onChange={(e) => setRule(e.target.value)}>
                <option value="">-</option>
                {rules.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
            </>
          )}
          <label className="sf-label" htmlFor={`${id}-reason`}>{fill(text.reason, { min: limits.minReason })}</label>
          <textarea id={`${id}-reason`} className="pc-field" rows={3} maxLength={limits.maxReason} value={reason} onChange={(e) => setReason(e.target.value)} />
          <p className="pc-meta">{text.notes[open]}</p>
          {error && <div className="notice notice-danger" role="alert">{error}</div>}
          <div className="ad-actionRow">
            <button type="submit" className="btn btn-primary">{text.continue}</button>
            <button type="button" className="btn btn-ghost" onClick={close}>{text.cancel}</button>
          </div>
        </form>
      )}

      {open && step === "confirm" && (
        <div className="ad-form">
          <p className="ad-sure">{fill(text.sure[open], { id: adId })}</p>
          <p className="pc-meta">{fill(text.notes[open], {})}</p>
          {error && <div className="notice notice-danger" role="alert">{error}</div>}
          <div className="ad-actionRow">
            <button type="button" className={`btn ${DESTRUCTIVE.includes(open) ? "btn-danger" : "btn-primary"}`} onClick={confirm} disabled={pending}>
              {pending ? text.working : text.buttons[open]}
            </button>
            <button type="button" className="btn btn-ghost" onClick={NEEDS_REASON.includes(open) ? () => setStep("form") : close} disabled={pending}>
              {NEEDS_REASON.includes(open) ? text.back : text.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
