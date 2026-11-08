"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logOutDevice, logOutOtherDevices } from "@/app/(site)/settings/sessions/actions";

// All visible text comes in as props (translated on the server), so this file has no words.
export type SessionItem = {
  id: string;
  name: string; // "Chrome · macOS" or the translated "Unknown device"
  ip: string | null;
  started: string; // already formatted (UTC), with the translated label
  active: string;
  current: boolean;
};

export type SessionsText = {
  current: string;
  logout: string;
  logoutOthers: string;
  only: string;
  working: string;
  error: string;
};

export default function SessionsList({
  items,
  ipLabels,
  text,
}: {
  items: SessionItem[];
  ipLabels: Record<string, string>; // session id -> "IP address: 1.2.3.4"
  text: SessionsText;
}) {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // a session id, or "others"
  const [pending, startTransition] = useTransition();
  const hasOthers = items.some((i) => !i.current);

  function run(key: string, action: () => Promise<{ ok: true } | { error: true }>) {
    if (pending) return;
    setError(false);
    setBusy(key);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setError(true);
      router.refresh();
      setBusy(null);
    });
  }

  return (
    <>
      <ul className="ss-list">
        {items.map((item) => (
          <li key={item.id} className={`ss-item ${item.current ? "ss-item-current" : ""}`}>
            <div className="ss-info">
              <span className="ss-name">
                {item.name}
                {item.current && <span className="ss-tag">{text.current}</span>}
              </span>
              {item.ip && <p className="ss-meta">{ipLabels[item.id]}</p>}
              <p className="ss-meta">{item.started}</p>
              <p className="ss-meta">{item.active}</p>
            </div>
            {!item.current && (
              <button
                type="button"
                className="pc-pill"
                disabled={pending}
                onClick={() => run(item.id, () => logOutDevice({ id: item.id }))}
              >
                {busy === item.id ? text.working : text.logout}
              </button>
            )}
          </li>
        ))}
      </ul>

      {error && <div className="notice notice-danger" role="alert">{text.error}</div>}

      {hasOthers ? (
        <div className="ss-others">
          <button
            type="button"
            className="pc-btn pc-btn-sm"
            disabled={pending}
            onClick={() => run("others", () => logOutOtherDevices())}
          >
            {busy === "others" ? text.working : text.logoutOthers}
          </button>
        </div>
      ) : (
        <p className="type-small">{text.only}</p>
      )}
    </>
  );
}
