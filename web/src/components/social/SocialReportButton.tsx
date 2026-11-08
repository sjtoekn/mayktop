"use client";

import { useState, useTransition } from "react";
import { reportSocialPost } from "@/app/(site)/social/report/actions";
import "@/app/(site)/manage/owner.css";

// All visible text comes in as props (translated on the server), so this file has no words.
export type SocialReportText = {
  report: string; // the button
  rule: string; // label of the rule list
  reason: string; // label of the text box
  submit: string;
  cancel: string;
  sending: string;
  done: string;
  already: string;
  login: string;
  tooMany: string;
  invalid: string;
  error: string;
};

type Props = {
  postId: number;
  rules: { key: string; label: string }[]; // the site rules, already translated
  limits: { min: number; max: number };
  text: SocialReportText;
};

/** "Report" under somebody else's Social post: choose the broken site rule, write why. The server checks everything again. */
export default function SocialReportButton({ postId, rules, limits, text }: Props) {
  const [open, setOpen] = useState(false);
  const [siteRule, setSiteRule] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const length = reason.trim().length;
  const canSend = !pending && siteRule !== "" && length >= limits.min && length <= limits.max;

  function send() {
    if (!canSend) return;
    setMessage("");
    startTransition(async () => {
      const result = await reportSocialPost({ postId, siteRule, reason });
      if ("error" in result) {
        setMessage(result.login ? text.login : result.tooMany ? text.tooMany : result.invalid ? text.invalid : text.error);
        return;
      }
      setSent(true);
      setOpen(false);
      setMessage(result.already ? text.already : text.done);
    });
  }

  return (
    <span className="sp-likeWrap">
      {!sent && (
        <button type="button" className="pc-pill" onClick={() => { setMessage(""); setOpen((o) => !o); }} disabled={pending} aria-expanded={open}>
          {text.report}
        </button>
      )}

      {message && (
        <span className="sp-likeError" role="status">
          {message}
        </span>
      )}

      {open && (
        <span className="oa-form sp-quoteForm">
          <label className="sf-label" htmlFor={`sp-report-rule-${postId}`}>{text.rule}</label>
          <select id={`sp-report-rule-${postId}`} className="pc-field" value={siteRule} onChange={(e) => setSiteRule(e.target.value)}>
            <option value="" />
            {rules.map((rule) => (
              <option key={rule.key} value={rule.key}>{rule.label}</option>
            ))}
          </select>
          <label className="sf-label" htmlFor={`sp-report-reason-${postId}`}>{text.reason}</label>
          <textarea
            id={`sp-report-reason-${postId}`}
            className="pc-field"
            rows={3}
            maxLength={limits.max}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <span className="sp-counter">{length}/{limits.max}</span>
          <span className="oa-buttons">
            <button type="button" className="pc-pill pc-pill-sm" disabled={pending} onClick={() => { setOpen(false); setMessage(""); }}>
              {text.cancel}
            </button>
            <button type="button" className="pc-btn pc-btn-sm" disabled={!canSend} onClick={send}>
              {pending ? text.sending : text.submit}
            </button>
          </span>
        </span>
      )}
    </span>
  );
}
