"use client";

import { useState, useTransition } from "react";
import { saveProfile, type ProfileErrorCode } from "@/app/(site)/settings/profile/actions";

// "Your profile" form (patch-profile-security). All visible text comes in as props (translated on the server).
export type ProfileSettingsText = {
  nameLabel: string;
  nameHelp: string;
  bioLabel: string;
  bioHelp: string;
  save: string;
  saving: string;
  saved: string;
  errors: Record<ProfileErrorCode, string>;
};

export default function ProfileSettingsForm({
  initialName,
  initialBio,
  nameMax,
  bioMax,
  text,
}: {
  initialName: string;
  initialBio: string;
  nameMax: number;
  bioMax: number;
  text: ProfileSettingsText;
}) {
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [message, setMessage] = useState<{ kind: "saved" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setMessage(null);
    startTransition(async () => {
      const result = await saveProfile({ displayName: name, bio });
      if ("error" in result) {
        setMessage({ kind: "error", text: text.errors[result.error] });
        return;
      }
      // Show what the server really saved (spaces tidied, empty = none).
      setName(result.displayName);
      setBio(result.bio);
      setMessage({ kind: "saved", text: text.saved });
    });
  }

  return (
    <form onSubmit={onSubmit} className="ps-form">
      <label className="sf-label" htmlFor="ps-name">{text.nameLabel}</label>
      <input
        id="ps-name"
        type="text"
        className="pc-field"
        value={name}
        maxLength={nameMax * 2}
        autoComplete="nickname"
        onChange={(e) => setName(e.target.value)}
      />
      <p className="pc-meta">{text.nameHelp}</p>

      <label className="sf-label" htmlFor="ps-bio">{text.bioLabel}</label>
      <textarea
        id="ps-bio"
        className="pc-field"
        rows={4}
        value={bio}
        maxLength={bioMax * 2}
        onChange={(e) => setBio(e.target.value)}
      />
      <p className="pc-meta">
        {text.bioHelp} <span dir="ltr">{Array.from(bio).length}/{bioMax}</span>
      </p>

      <div className="ps-actions">
        <button type="submit" className="pc-btn pc-btn-sm" disabled={pending}>
          {pending ? text.saving : text.save}
        </button>
        {message && (
          <span className={message.kind === "error" ? "notice notice-danger" : "pc-meta"} role={message.kind === "error" ? "alert" : "status"}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
