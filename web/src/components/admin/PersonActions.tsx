"use client";
// The action buttons on a person's page (admin Part 2): Suspend, Lift, Make admin, Remove admin.
// Every action has two steps: fill in (rule, days, written reason) -> an "are you sure" step -> done.
// All visible text comes in as props (translated on the server). The rules are enforced again in staff.ts.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { personAction } from "@/app/admin/people/[username]/actions";

type Kind = "suspend" | "lift" | "makeAdmin" | "removeAdmin" | "proposeBan";

export type PersonActionsText = {
  title: string;
  buttons: Record<Kind, string>; // button labels
  notes: Record<Kind, string>; // one line under the form
  sure: Record<Kind, string>; // the "are you sure" question, with {name} and {days}
  rule: string;
  days: string;
  reason: string;
  continue: string;
  back: string;
  cancel: string;
  working: string;
  done: string;
  errors: Record<string, string>; // by staff error code, plus "other"
};

type Props = {
  username: string;
  name: string;
  actions: Kind[];
  rules: { key: string; label: string }[];
  limits: { minReason: number; maxReason: number; maxDays: number };
  text: PersonActionsText;
};

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in params ? String(params[key]) : whole));
}

const DESTRUCTIVE: Kind[] = ["suspend", "removeAdmin", "proposeBan"];

export default function PersonActions({ username, name, actions, rules, limits, text }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<Kind | null>(null);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [rule, setRule] = useState("");
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function start(kind: Kind) {
    setOpen(kind);
    setStep(kind === "makeAdmin" ? "confirm" : "form");
    setRule("");
    setDays("7");
    setReason("");
    setError(null);
    setDone(false);
  }

  function close() {
    setOpen(null);
    setStep("form");
    setError(null);
  }

  const needsReason = open === "suspend" || open === "lift" || open === "removeAdmin" || open === "proposeBan";

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (!open) return;
    const code = (key: string) => fill(text.errors[key] ?? text.errors.other, { min: limits.minReason, max: limits.maxReason, days: limits.maxDays });
    if (open === "suspend" || open === "proposeBan") {
      if (!rules.some((r) => r.key === rule)) return setError(code("rule"));
    }
    if (open === "suspend") {
      const n = Number(days);
      if (!Number.isInteger(n) || n < 1 || n > limits.maxDays) return setError(code("days"));
    }
    if (needsReason) {
      const length = reason.trim().length;
      if (length < limits.minReason || length > limits.maxReason) return setError(code("reason"));
    }
    setError(null);
    setStep("confirm");
  }

  function confirm() {
    if (!open || pending) return;
    const kind = open;
    startTransition(async () => {
      const result = await personAction({
        kind,
        username,
        rule: kind === "suspend" || kind === "proposeBan" ? rule : undefined,
        days: kind === "suspend" ? Number(days) : undefined,
        reason: needsReason ? reason : undefined,
      });
      if ("error" in result) {
        setError(fill(text.errors[result.error] ?? text.errors.other, { min: limits.minReason, max: limits.maxReason, days: limits.maxDays }));
        setStep(kind === "makeAdmin" ? "confirm" : "form");
        return;
      }
      setDone(true);
      close();
      router.refresh();
    });
  }

  return (
    <section className="card ad-actions" aria-labelledby="ad-actions-title">
      <h2 id="ad-actions-title" className="pc-title">{text.title}</h2>

      {done && <div className="notice notice-success" role="status">{text.done}</div>}

      {!open && (
        <div className="ad-actionRow">
          {actions.map((kind) => (
            <button key={kind} type="button" className="btn btn-secondary" onClick={() => start(kind)}>
              {text.buttons[kind]}
            </button>
          ))}
        </div>
      )}

      {open && step === "form" && (
        <form onSubmit={next} className="ad-form">
          <h3 className="ad-formTitle">{text.buttons[open]}</h3>
          {(open === "suspend" || open === "proposeBan") && (
            <>
              <label className="sf-label" htmlFor="ad-rule">{text.rule}</label>
              <select id="ad-rule" className="pc-field" value={rule} onChange={(e) => setRule(e.target.value)}>
                <option value="" disabled>—</option>
                {rules.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
              {open === "suspend" && (
                <>
              <label className="sf-label" htmlFor="ad-days">{fill(text.days, { max: limits.maxDays })}</label>
              <input id="ad-days" className="pc-field ad-days" type="number" min={1} max={limits.maxDays} step={1} value={days} onChange={(e) => setDays(e.target.value)} />
                </>
              )}
            </>
          )}
          {needsReason && (
            <>
              <label className="sf-label" htmlFor="ad-reason">{fill(text.reason, { min: limits.minReason })}</label>
              <textarea id="ad-reason" className="pc-field" rows={4} maxLength={limits.maxReason} value={reason} onChange={(e) => setReason(e.target.value)} />
            </>
          )}
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
          <p className="ad-sure">{fill(text.sure[open], { name, days: Number(days) || 0 })}</p>
          {open !== "makeAdmin" && <p className="pc-meta">{text.notes[open]}</p>}
          {error && <div className="notice notice-danger" role="alert">{error}</div>}
          <div className="ad-actionRow">
            <button type="button" className={`btn ${DESTRUCTIVE.includes(open) ? "btn-danger" : "btn-primary"}`} onClick={confirm} disabled={pending}>
              {pending ? text.working : text.buttons[open]}
            </button>
            <button type="button" className="btn btn-ghost" onClick={open === "makeAdmin" ? close : () => setStep("form")} disabled={pending}>
              {open === "makeAdmin" ? text.cancel : text.back}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
