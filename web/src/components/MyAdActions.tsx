"use client";
// The Pause / Run again / End buttons under one ad on "My ads" (ADS_PLAN Sessions 4a + 4b): button -> "are you sure" -> done.
// All visible text comes in as props (translated on the server). The rules are enforced again on the server.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { myAdAction } from "@/app/(site)/advertise/my/actions";

type Kind = "pause" | "resume" | "end";

export type MyAdActionsText = {
  buttons: Record<Kind, string>;
  notes: Record<Kind, string>; // one line shown with the question
  sure: Record<Kind, string>;
  yes: string;
  cancel: string;
  working: string;
  errors: Record<string, string>; // by error code, plus "other"
};

export default function MyAdActions({ adId, actions, text }: { adId: number; actions: Kind[]; text: MyAdActionsText }) {
  const router = useRouter();
  const [open, setOpen] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (actions.length === 0) return null;

  function confirm() {
    if (!open || pending) return;
    const kind = open;
    startTransition(async () => {
      const result = await myAdAction({ adId, kind });
      if ("error" in result) {
        setError(text.errors[result.error] ?? text.errors.other);
        return;
      }
      setOpen(null);
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="my-actions">
      {open === null && (
        <div className="adv-actions">
          {actions.map((kind) => (
            <button
              key={kind}
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setOpen(kind);
                setError(null);
              }}
            >
              {text.buttons[kind]}
            </button>
          ))}
        </div>
      )}
      {open !== null && (
        <div className="notice notice-warning" role="group" aria-label={text.sure[open]}>
          <p className="my-ask">{text.sure[open]}</p>
          <p className="pc-meta">{text.notes[open]}</p>
          <div className="adv-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={confirm} disabled={pending}>
              {pending ? text.working : text.yes}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(null)} disabled={pending}>
              {text.cancel}
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="notice notice-info" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
