"use client";
// The box under one Social REPLY or one reported ACCOUNT in /admin/social (patch-social-report-more). Three kinds:
//  mode "hide":   a reported reply that is still visible -> hide it for review (site rule + written reason), or dismiss the reports.
//  mode "decide": a hidden reply -> restore or remove it (written note).
//  mode "close":  a reported account -> dismiss the reports, or mark them handled (written note). Nothing happens to the account itself.
// Always: written text -> "are you sure" -> done. All visible text comes in as props (translated on the server).
// The rules are enforced again on the server (src/lib/social-reply-review.ts).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { socialItemModeration } from "@/app/admin/social/more-actions";

export type SocialItemModerationText = {
  rule: string; // label of the rule list
  reason: string; // label of the text box, with {min}
  hide: string;
  dismiss: string;
  restore: string;
  remove: string;
  handled: string;
  sure: { hide: string; dismiss: string; restore: string; remove: string; handled: string };
  back: string;
  working: string;
  done: string;
  errors: Record<string, string>; // by error code, plus "other"
};

type Action = "hide" | "dismiss" | "restore" | "remove" | "handled";

type Props = {
  kind: "reply" | "account";
  mode: "hide" | "decide" | "close";
  id: string;
  rules: { key: string; label: string }[];
  limits: { minReason: number; maxReason: number };
  text: SocialItemModerationText;
};

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in params ? String(params[key]) : whole));
}

export default function SocialItemModerationBox({ kind, mode, id, rules, limits, text }: Props) {
  const router = useRouter();
  const [siteRule, setSiteRule] = useState("");
  const [note, setNote] = useState("");
  const [choice, setChoice] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const message = (code: string) => fill(text.errors[code] ?? text.errors.other, { min: limits.minReason, max: limits.maxReason });

  function pick(which: Action) {
    const length = note.trim().length;
    if (which === "hide" && siteRule === "") return setError(message("rule"));
    if (length < limits.minReason || length > limits.maxReason) return setError(message("reason"));
    setError(null);
    setChoice(which);
  }

  function confirm() {
    if (!choice || pending) return;
    const action = choice;
    startTransition(async () => {
      const result = await socialItemModeration({ kind, action, id, siteRule: action === "hide" ? siteRule : undefined, text: note });
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
        <p className="ad-sure">{text.sure[choice]}</p>
        <div className="ad-actionRow">
          <button type="button" className={`btn ${choice === "remove" || choice === "hide" ? "btn-danger" : "btn-primary"}`} onClick={confirm} disabled={pending}>
            {pending ? text.working : text[choice]}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setChoice(null)} disabled={pending}>{text.back}</button>
        </div>
      </div>
    );
  }

  const noteField = `ad-social-note-${kind}-${mode}-${id}`;
  return (
    <div className="ad-form">
      {mode === "hide" && (
        <>
          <label className="sf-label" htmlFor={`ad-social-rule-${kind}-${id}`}>{text.rule}</label>
          <select id={`ad-social-rule-${kind}-${id}`} className="pc-field" value={siteRule} onChange={(e) => setSiteRule(e.target.value)}>
            <option value="" />
            {rules.map((rule) => (
              <option key={rule.key} value={rule.key}>{rule.label}</option>
            ))}
          </select>
        </>
      )}
      <label className="sf-label" htmlFor={noteField}>{fill(text.reason, { min: limits.minReason })}</label>
      <textarea id={noteField} className="pc-field" rows={3} maxLength={limits.maxReason} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <div className="notice notice-danger" role="alert">{error}</div>}
      <div className="ad-actionRow">
        {mode === "hide" && (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => pick("hide")}>{text.hide}</button>
            <button type="button" className="btn btn-secondary" onClick={() => pick("dismiss")}>{text.dismiss}</button>
          </>
        )}
        {mode === "decide" && (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => pick("restore")}>{text.restore}</button>
            <button type="button" className="btn btn-secondary" onClick={() => pick("remove")}>{text.remove}</button>
          </>
        )}
        {mode === "close" && (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => pick("handled")}>{text.handled}</button>
            <button type="button" className="btn btn-secondary" onClick={() => pick("dismiss")}>{text.dismiss}</button>
          </>
        )}
      </div>
    </div>
  );
}
