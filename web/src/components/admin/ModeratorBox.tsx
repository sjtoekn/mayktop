"use client";
// The moderators of ONE community on the admin Communities screen (Part 7): the list, "Remove" next to each moderator,
// and "Add moderator". Every change has two steps: fill in (who + written reason) -> an "are you sure" step -> done.
// All visible text comes in as props (translated on the server). The rules are enforced again in moderators.ts.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { moderatorAction } from "@/app/admin/communities/actions";

export type ModeratorBoxText = {
  none: string; // "No moderators..."
  add: string;
  remove: string;
  person: string; // label of the username field
  reason: string; // label, with {min}
  noteAdd: string;
  noteRemove: string;
  sureAdd: string; // with {name} and {community}
  sureRemove: string; // with {name} and {community}
  continue: string;
  back: string;
  cancel: string;
  working: string;
  done: string;
  errors: Record<string, string>; // by moderator error code, plus "other"; may contain {min} {max} {maxLarge} {threshold}
};

type Mode = { kind: "add" } | { kind: "remove"; person: string };

type Props = {
  slug: string;
  mods: { person: string; since: string }[]; // "since" is already formatted text
  limits: { minReason: number; maxReason: number; maxLarge: number; threshold: number };
  text: ModeratorBoxText;
};

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in params ? String(params[key]) : whole));
}

export default function ModeratorBox({ slug, mods, limits, text }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [person, setPerson] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const message = (code: string) =>
    fill(text.errors[code] ?? text.errors.other, {
      min: limits.minReason,
      max: limits.maxReason,
      maxLarge: limits.maxLarge,
      threshold: limits.threshold,
    });

  function start(next: Mode) {
    setMode(next);
    setStep("form");
    setPerson("");
    setReason("");
    setError(null);
    setDone(false);
  }

  function close() {
    setMode(null);
    setStep("form");
    setError(null);
  }

  const target = mode ? (mode.kind === "add" ? person.trim().replace(/^@/, "") : mode.person) : "";

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (!mode) return;
    if (mode.kind === "add" && target.length === 0) return setError(message("notfound"));
    const length = reason.trim().length;
    if (length < limits.minReason || length > limits.maxReason) return setError(message("reason"));
    setError(null);
    setStep("confirm");
  }

  function confirm() {
    if (!mode || pending) return;
    const kind = mode.kind;
    startTransition(async () => {
      const result = await moderatorAction({ kind, community: slug, person: target, reason });
      if ("error" in result) {
        setError(message(result.error));
        setStep("form"); // back to the form so the reason is not lost
        return;
      }
      setMode(null);
      setDone(true);
      router.refresh();
    });
  }

  const id = `cm-${slug}`;
  return (
    <div className="cm-mods">
      {mods.length === 0 ? (
        <div className="notice notice-info">{text.none}</div>
      ) : (
        <ul className="cm-modList">
          {mods.map((m) => (
            <li key={m.person} className="cm-modRow">
              <Link href={`/admin/people/${encodeURIComponent(m.person)}`} className="cm-modName">
                <b>@{m.person}</b>
                <span className="pc-meta">{m.since}</span>
              </Link>
              {!(mode && mode.kind === "remove" && mode.person === m.person) && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => start({ kind: "remove", person: m.person })}>
                  {text.remove}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {done && !mode && <div className="notice notice-success" role="status">{text.done}</div>}

      {!mode && (
        <div className="ad-actionRow">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => start({ kind: "add" })}>
            {text.add}
          </button>
        </div>
      )}

      {mode && step === "form" && (
        <form className="ad-form" onSubmit={next}>
          {mode.kind === "add" && (
            <>
              <label className="sf-label" htmlFor={`${id}-person`}>{text.person}</label>
              <input id={`${id}-person`} className="pc-field" type="text" maxLength={64} autoComplete="off" value={person} onChange={(e) => setPerson(e.target.value)} />
            </>
          )}
          <label className="sf-label" htmlFor={`${id}-reason`}>{fill(text.reason, { min: limits.minReason })}</label>
          <textarea id={`${id}-reason`} className="pc-field" rows={3} maxLength={limits.maxReason} value={reason} onChange={(e) => setReason(e.target.value)} />
          <p className="pc-meta">{mode.kind === "add" ? text.noteAdd : text.noteRemove}</p>
          {error && <div className="notice notice-danger" role="alert">{error}</div>}
          <div className="ad-actionRow">
            <button type="submit" className="btn btn-primary">{text.continue}</button>
            <button type="button" className="btn btn-ghost" onClick={close}>{text.cancel}</button>
          </div>
        </form>
      )}

      {mode && step === "confirm" && (
        <div className="ad-form">
          <p className="ad-sure">{fill(mode.kind === "add" ? text.sureAdd : text.sureRemove, { name: target, community: slug })}</p>
          {error && <div className="notice notice-danger" role="alert">{error}</div>}
          <div className="ad-actionRow">
            <button type="button" className={`btn ${mode.kind === "remove" ? "btn-danger" : "btn-primary"}`} onClick={confirm} disabled={pending}>
              {pending ? text.working : mode.kind === "add" ? text.add : text.remove}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setStep("form")} disabled={pending}>{text.back}</button>
          </div>
        </div>
      )}
    </div>
  );
}
