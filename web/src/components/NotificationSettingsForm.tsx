"use client";

import { useState, useTransition } from "react";
import { saveNotificationSettings } from "@/app/(site)/settings/notifications/actions";

// All visible text comes in as props (translated on the server), so this file has no words.
export type NotificationSettingsText = {
  save: string;
  saving: string;
  saved: string;
  login: string;
  tooMany: string;
  error: string;
};

export type NotificationSettingOption = { type: string; label: string; enabled: boolean };

export default function NotificationSettingsForm({ options, text }: { options: NotificationSettingOption[]; text: NotificationSettingsText }) {
  const [on, setOn] = useState<Set<string>>(() => new Set(options.filter((o) => o.enabled).map((o) => o.type)));
  const [message, setMessage] = useState<{ kind: "saved" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(type: string) {
    setMessage(null);
    setOn((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function save() {
    if (pending) return;
    setMessage(null);
    startTransition(async () => {
      const result = await saveNotificationSettings([...on]);
      if ("error" in result) {
        setMessage({ kind: "error", text: result.login ? text.login : result.tooMany ? text.tooMany : text.error });
        return;
      }
      setMessage({ kind: "saved", text: text.saved });
    });
  }

  return (
    <div className="ns-form">
      <ul className="ns-list">
        {options.map((option) => (
          <li key={option.type}>
            <label className="ns-row">
              <input type="checkbox" checked={on.has(option.type)} onChange={() => toggle(option.type)} disabled={pending} />
              <span>{option.label}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="ns-actions">
        <button type="button" className="pc-btn pc-btn-sm" onClick={save} disabled={pending}>
          {pending ? text.saving : text.save}
        </button>
        {message && (
          <span className={message.kind === "error" ? "notice notice-danger" : "pc-meta"} role={message.kind === "error" ? "alert" : "status"}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
