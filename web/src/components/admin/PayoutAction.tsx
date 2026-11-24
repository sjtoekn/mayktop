"use client";
// One button (with its small form and an "are you sure" step) on the admin Payouts screen (TODO 12, S8):
// make a round, mark a payout paid / failed, freeze / release earnings, take back the open balance.
// All visible text comes in as props (translated on the server). The rules are enforced again in creator-payouts.ts.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { payoutAction, type PayoutActionKind } from "@/app/admin/payouts/actions";

export type PayoutActionText = {
  button: string;
  sure: string; // the question before the final click
  field?: string; // label of the reference / reason box (none for "batch")
  continue: string;
  cancel: string;
  back: string;
  working: string;
  done: string;
  errors: Record<string, string>; // by error code, plus "other"
};

type Props = {
  kind: PayoutActionKind;
  payoutId?: number;
  userId?: string;
  country?: string | null;
  text: PayoutActionText;
  danger?: boolean;
  maxLength?: number;
};

export default function PayoutAction({ kind, payoutId, userId, country, text, danger, maxLength = 300 }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"closed" | "form" | "confirm">("closed");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const needsText = kind !== "batch";
  const id = `payout-${kind}-${payoutId ?? userId ?? country ?? "all"}`;

  function open() {
    setValue("");
    setError(null);
    setStep(needsText ? "form" : "confirm");
  }
  function close() {
    setStep("closed");
    setError(null);
  }
  function next(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim().length < 3) return setError(text.errors[kind === "paid" ? "reference" : "reason"] ?? text.errors.other);
    setError(null);
    setStep("confirm");
  }
  function confirm() {
    if (pending) return;
    startTransition(async () => {
      const result = await payoutAction({ kind, payoutId, userId, country, text: needsText ? value : undefined });
      if ("error" in result) {
        setError(text.errors[result.error] ?? text.errors.other);
        setStep(needsText ? "form" : "confirm");
        return;
      }
      setStep("closed");
      setDone(true);
      router.refresh();
    });
  }

  if (done) return <div className="notice notice-success" role="status">{text.done}</div>;
  if (step === "closed") {
    return (
      <button type="button" className={`btn ${danger ? "btn-secondary" : "btn-primary"} btn-sm`} onClick={open}>
        {text.button}
      </button>
    );
  }
  if (step === "form") {
    return (
      <form className="ad-form" onSubmit={next}>
        <label className="sf-label" htmlFor={id}>{text.field}</label>
        <input id={id} className="pc-field" value={value} maxLength={maxLength} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
        {error && <div className="notice notice-danger" role="alert">{error}</div>}
        <div className="ad-actionRow">
          <button type="submit" className="btn btn-primary btn-sm">{text.continue}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={close}>{text.cancel}</button>
        </div>
      </form>
    );
  }
  return (
    <div className="ad-form">
      <p className="ad-sure">{text.sure}</p>
      {error && <div className="notice notice-danger" role="alert">{error}</div>}
      <div className="ad-actionRow">
        <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"} btn-sm`} onClick={confirm} disabled={pending}>
          {pending ? text.working : text.button}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={needsText ? () => setStep("form") : close} disabled={pending}>
          {needsText ? text.back : text.cancel}
        </button>
      </div>
    </div>
  );
}
