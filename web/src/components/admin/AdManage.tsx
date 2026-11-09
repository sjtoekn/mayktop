"use client";
// Admin: Edit / Delete buttons for ANY ad (added 2026-11-09). Shown under every ad on /admin/ads and on the ad detail page.
// Admin-only screen, so the words are plain English constants here. The server checks everything again (admin-ad-manage.ts).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminDeleteAdAction, adminEditAdAction } from "@/app/admin/ads/actions";

type Props = {
  adId: number;
  format: "TEXT" | "IMAGE" | "VIDEO";
  initial: { title: string; body: string; url: string; email: string; slot: string };
  slots: string[];
  limits: { titleMax: number; bodyMax: number };
  redirectAfterDelete?: string; // the detail page sends the admin back to the list after a delete
};

const SLOT_LABEL: Record<string, string> = {
  SIDEBAR: "Sidebar",
  FEED: "Feed (between posts)",
  SOCIAL_FEED: "Social feed",
  HEADER: "Header banner (picture ads only)",
};

const ERRORS: Record<string, string> = {
  type: "Something in the form is not valid.",
  notfound: "This ad does not exist any more.",
  title: "The title is too short or too long.",
  body: "The text is too short or too long.",
  url: "The link must be a full https:// address of a public website.",
  email: "The contact email does not look right.",
  slot: "This place is not allowed for this ad (the header banner is for picture ads only).",
  appeal: "This ad has an open appeal. Decide the appeal first, then delete the ad.",
  other: "Something went wrong. Nothing was changed.",
};

export default function AdManage({ adId, format, initial, slots, limits, redirectAfterDelete }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "edit" | "delete">("none");
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [url, setUrl] = useState(initial.url);
  const [email, setEmail] = useState(initial.email);
  const [slot, setSlot] = useState(initial.slot);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const id = `ad-manage-${adId}`;
  const allowedSlots = slots.filter((s) => s !== "HEADER" || format === "IMAGE");

  function open(next: "edit" | "delete") {
    setMode(next);
    setError(null);
    setSaved(false);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    startTransition(async () => {
      const result = await adminEditAdAction({ adId, title, body, url, email, slot });
      if ("error" in result) {
        setError(ERRORS[result.error] ?? ERRORS.other);
        return;
      }
      setError(null);
      setSaved(true);
      setMode("none");
      router.refresh();
    });
  }

  function remove() {
    if (pending) return;
    startTransition(async () => {
      const result = await adminDeleteAdAction({ adId });
      if ("error" in result) {
        setError(ERRORS[result.error] ?? ERRORS.other);
        return;
      }
      if (redirectAfterDelete) router.push(redirectAfterDelete);
      router.refresh();
    });
  }

  return (
    <div className="ad-form ad-manage">
      {saved && mode === "none" && <div className="notice notice-success" role="status">Saved.</div>}

      {mode === "none" && (
        <div className="ad-actionRow">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => open("edit")}>Edit this ad</button>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => open("delete")}>Delete this ad</button>
        </div>
      )}

      {mode === "edit" && (
        <form className="ad-form" onSubmit={save} noValidate>
          <label className="sf-label" htmlFor={`${id}-title`}>Title</label>
          <input id={`${id}-title`} className="pc-field" value={title} maxLength={limits.titleMax} onChange={(e) => setTitle(e.target.value)} />

          <label className="sf-label" htmlFor={`${id}-body`}>Text</label>
          <textarea id={`${id}-body`} className="pc-field" rows={3} value={body} maxLength={limits.bodyMax} onChange={(e) => setBody(e.target.value)} />

          <label className="sf-label" htmlFor={`${id}-url`}>Link (https://...)</label>
          <input id={`${id}-url`} className="pc-field" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} />

          <label className="sf-label" htmlFor={`${id}-email`}>Contact email</label>
          <input id={`${id}-email`} className="pc-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

          <label className="sf-label" htmlFor={`${id}-slot`}>Where it is shown</label>
          <select id={`${id}-slot`} className="pc-field" value={slot} onChange={(e) => setSlot(e.target.value)}>
            {allowedSlots.map((s) => (
              <option key={s} value={s}>{SLOT_LABEL[s] ?? s}</option>
            ))}
          </select>

          {error && <div className="notice notice-danger" role="alert">{error}</div>}
          <div className="ad-actionRow">
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>{pending ? "Saving..." : "Save changes"}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode("none")} disabled={pending}>Cancel</button>
          </div>
        </form>
      )}

      {mode === "delete" && (
        <div className="ad-form">
          <p className="ad-sure">Delete ad #{adId} for good? Its numbers (shown / clicks) are deleted too. This cannot be undone.</p>
          {error && <div className="notice notice-danger" role="alert">{error}</div>}
          <div className="ad-actionRow">
            <button type="button" className="btn btn-danger btn-sm" onClick={remove} disabled={pending}>{pending ? "Deleting..." : "Yes, delete it"}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode("none")} disabled={pending}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
