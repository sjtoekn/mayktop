"use client";
// The action buttons on a person's page (admin Part 2): Edit profile, Suspend, Lift, Make admin, Remove admin, Propose ban, Erase now.
// Every action has two steps: fill in (rule, days, written reason) -> an "are you sure" step -> done.
// All visible text comes in as props (translated on the server). The rules are enforced again in staff.ts.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { personAction } from "@/app/admin/people/[username]/actions";

type Kind = "edit" | "suspend" | "lift" | "makeAdmin" | "removeAdmin" | "proposeBan" | "erase" | "verify" | "unverify";

export type PersonActionsText = {
  title: string;
  buttons: Record<Kind, string>; // button labels
  notes: Record<Kind, string>; // one line under the form
  sure: Record<Kind, string>; // the "are you sure" question, with {name} and {days}
  rule: string;
  days: string;
  reason: string;
  fields: { displayName: string; bio: string; username: string; email: string; confirm: string }; // labels of the edit form; confirm has {username}
  erased: string; // shown after an erasure
  erasedNotes: string; // "take care of these by hand:" (ads to refund, community that needs a moderator)
  erasedOpen: string; // button: open the history of the erased account
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
  limits: { minReason: number; maxReason: number; maxDays: number; maxName: number; maxBio: number };
  profile: { displayName: string; bio: string; username: string; email: string }; // the values now: the edit form starts with them
  text: PersonActionsText;
};

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in params ? String(params[key]) : whole));
}

const DESTRUCTIVE: Kind[] = ["suspend", "removeAdmin", "proposeBan", "erase", "unverify"];
// These two have nothing to fill in: the button goes straight to the "are you sure" step.
const CONFIRM_ONLY: Kind[] = ["makeAdmin", "verify"];

export default function PersonActions({ username, name, actions, rules, limits, profile, text }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<Kind | null>(null);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [rule, setRule] = useState("");
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const [form, setForm] = useState(profile); // edit: the four fields
  const [typed, setTyped] = useState(""); // erase: the username typed as confirmation
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null); // the message after a finished action
  const [afterNotes, setAfterNotes] = useState<{ notes: string[]; next: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function start(kind: Kind) {
    setOpen(kind);
    setStep(CONFIRM_ONLY.includes(kind) ? "confirm" : "form");
    setRule("");
    setDays("7");
    setReason("");
    setForm(profile);
    setTyped("");
    setError(null);
    setDone(null);
    setAfterNotes(null);
  }

  function close() {
    setOpen(null);
    setStep("form");
    setError(null);
  }

  const needsReason = open === "edit" || open === "suspend" || open === "lift" || open === "removeAdmin" || open === "unverify" || open === "proposeBan" || open === "erase";
  const errorParams = { min: limits.minReason, max: limits.maxReason, days: limits.maxDays, nameMax: limits.maxName, bioMax: limits.maxBio };

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (!open) return;
    const code = (key: string) => fill(text.errors[key] ?? text.errors.other, errorParams);
    if (open === "edit") {
      const same = form.displayName.trim() === profile.displayName && form.bio.trim() === profile.bio && form.username.trim().toLowerCase() === profile.username && form.email.trim().toLowerCase() === profile.email;
      if (same) return setError(code("nochange"));
    }
    if (open === "erase") {
      if (typed.trim().replace(/^@/, "").toLowerCase() !== username) return setError(code("confirm"));
    }
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
        displayName: kind === "edit" ? form.displayName : undefined,
        bio: kind === "edit" ? form.bio : undefined,
        newUsername: kind === "edit" ? form.username : undefined,
        email: kind === "edit" ? form.email : undefined,
        confirm: kind === "erase" ? typed : undefined,
      });
      if ("error" in result) {
        setError(fill(text.errors[result.error] ?? text.errors.other, errorParams));
        setStep(CONFIRM_ONLY.includes(kind) ? "confirm" : "form");
        return;
      }
      if (kind === "erase") {
        // The old address of this page no longer exists. Show what must be done by hand (if anything), then go on.
        close();
        setDone(text.erased);
        if (result.notes && result.notes.length > 0 && result.next) {
          setAfterNotes({ notes: result.notes, next: result.next });
        } else if (result.next) {
          router.replace(result.next);
        }
        return;
      }
      setDone(text.done);
      close();
      if (result.next) router.replace(result.next);
      else router.refresh();
    });
  }

  return (
    <section className="card ad-actions" aria-labelledby="ad-actions-title">
      <h2 id="ad-actions-title" className="pc-title">{text.title}</h2>

      {done && <div className="notice notice-success" role="status">{done}</div>}
      {afterNotes && (
        <div className="notice notice-warning">
          <p>{text.erasedNotes}</p>
          <ul>
            {afterNotes.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <button type="button" className="btn btn-secondary" onClick={() => router.replace(afterNotes.next)}>{text.erasedOpen}</button>
        </div>
      )}

      {!open && !afterNotes && (
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
          {open === "edit" && (
            <>
              <label className="sf-label" htmlFor="ad-f-name">{text.fields.displayName}</label>
              <input id="ad-f-name" className="pc-field" type="text" maxLength={limits.maxName * 2} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
              <label className="sf-label" htmlFor="ad-f-username">{text.fields.username}</label>
              <input id="ad-f-username" className="pc-field" type="text" maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck={false} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <label className="sf-label" htmlFor="ad-f-email">{text.fields.email}</label>
              <input id="ad-f-email" className="pc-field" type="email" maxLength={254} autoCapitalize="none" autoCorrect="off" spellCheck={false} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <label className="sf-label" htmlFor="ad-f-bio">{text.fields.bio}</label>
              <textarea id="ad-f-bio" className="pc-field" rows={4} maxLength={limits.maxBio * 2} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </>
          )}
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
          {open === "erase" && (
            <>
              <label className="sf-label" htmlFor="ad-f-confirm">{fill(text.fields.confirm, { username })}</label>
              <input id="ad-f-confirm" className="pc-field" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
            </>
          )}
          <p className="pc-meta">{text.notes[open]}</p>
          {error && <div className="notice notice-danger" role="alert">{error}</div>}
          <div className="ad-actionRow">
            <button type="submit" className={`btn ${open === "erase" ? "btn-danger" : "btn-primary"}`}>{text.continue}</button>
            <button type="button" className="btn btn-ghost" onClick={close}>{text.cancel}</button>
          </div>
        </form>
      )}

      {open && step === "confirm" && (
        <div className="ad-form">
          <p className="ad-sure">{fill(text.sure[open], { name, days: Number(days) || 0 })}</p>
          {!CONFIRM_ONLY.includes(open) && <p className="pc-meta">{text.notes[open]}</p>}
          {error && <div className="notice notice-danger" role="alert">{error}</div>}
          <div className="ad-actionRow">
            <button type="button" className={`btn ${DESTRUCTIVE.includes(open) ? "btn-danger" : "btn-primary"}`} onClick={confirm} disabled={pending}>
              {pending ? text.working : text.buttons[open]}
            </button>
            <button type="button" className="btn btn-ghost" onClick={CONFIRM_ONLY.includes(open) ? close : () => setStep("form")} disabled={pending}>
              {CONFIRM_ONLY.includes(open) ? text.cancel : text.back}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
