"use client";

import { useState, useTransition } from "react";
import { saveProfile, type ProfileErrorCode } from "@/app/(site)/settings/profile/actions";

// "Your profile" form (patch-profile-security; professional fields: SITE_PLAN C7). All visible text comes in as props (translated on the server).
export type ProfileSettingsText = {
  nameLabel: string;
  nameHelp: string;
  bioLabel: string;
  bioHelp: string;
  professionLabel: string;
  professionHelp: string;
  qualificationsLabel: string;
  qualificationsHelp: string;
  websiteLabel: string;
  websiteHelp: string;
  videoLabel: string;
  videoHelp: string;
  linksLabel: string;
  linksHelp: string;
  siteLabels: Record<string, string>; // by kind: "LinkedIn", "GitHub" ...
  verifiedNote: string; // shown only when the profile is verified
  save: string;
  saving: string;
  saved: string;
  errors: Record<ProfileErrorCode, string>;
};

export type ProfileFormValues = {
  displayName: string;
  bio: string;
  profession: string;
  qualifications: string;
  website: string;
  video: string;
  links: Record<string, string>;
};

export default function ProfileSettingsForm({
  initial,
  kinds,
  nameMax,
  bioMax,
  professionMax,
  qualificationsMax,
  websiteMax,
  verified,
  text,
}: {
  initial: ProfileFormValues;
  kinds: string[]; // the social sites, in the order they are shown
  nameMax: number;
  bioMax: number;
  professionMax: number;
  qualificationsMax: number;
  websiteMax: number;
  verified: boolean;
  text: ProfileSettingsText;
}) {
  const [name, setName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);
  const [profession, setProfession] = useState(initial.profession);
  const [qualifications, setQualifications] = useState(initial.qualifications);
  const [website, setWebsite] = useState(initial.website);
  const [video, setVideo] = useState(initial.video);
  const [links, setLinks] = useState<Record<string, string>>(initial.links);
  const [message, setMessage] = useState<{ kind: "saved" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setMessage(null);
    startTransition(async () => {
      const result = await saveProfile({ displayName: name, bio, profession, qualifications, website, video, links });
      if ("error" in result) {
        setMessage({ kind: "error", text: text.errors[result.error] });
        return;
      }
      // Show what the server really saved (spaces tidied, "https://" added, empty = none).
      setName(result.displayName);
      setBio(result.bio);
      setProfession(result.profession);
      setQualifications(result.qualifications);
      setWebsite(result.website);
      setVideo(result.video);
      setLinks(result.links);
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

      <label className="sf-label" htmlFor="ps-profession">{text.professionLabel}</label>
      <input
        id="ps-profession"
        type="text"
        className="pc-field"
        value={profession}
        maxLength={professionMax * 2}
        autoComplete="organization-title"
        onChange={(e) => setProfession(e.target.value)}
      />
      <p className="pc-meta">{text.professionHelp}</p>

      <label className="sf-label" htmlFor="ps-qualifications">{text.qualificationsLabel}</label>
      <textarea
        id="ps-qualifications"
        className="pc-field"
        rows={4}
        value={qualifications}
        maxLength={qualificationsMax * 2}
        onChange={(e) => setQualifications(e.target.value)}
      />
      <p className="pc-meta">
        {text.qualificationsHelp} <span dir="ltr">{Array.from(qualifications).length}/{qualificationsMax}</span>
      </p>

      <label className="sf-label" htmlFor="ps-website">{text.websiteLabel}</label>
      <input
        id="ps-website"
        type="url"
        inputMode="url"
        dir="ltr"
        className="pc-field"
        value={website}
        maxLength={websiteMax * 2}
        autoComplete="url"
        placeholder="https://"
        onChange={(e) => setWebsite(e.target.value)}
      />
      <p className="pc-meta">{text.websiteHelp}</p>

      <label className="sf-label" htmlFor="ps-video">{text.videoLabel}</label>
      <input
        id="ps-video"
        type="url"
        inputMode="url"
        dir="ltr"
        className="pc-field"
        value={video}
        maxLength={websiteMax * 2}
        placeholder="https://www.youtube.com/watch?v="
        onChange={(e) => setVideo(e.target.value)}
      />
      <p className="pc-meta">{text.videoHelp}</p>

      <p className="sf-label">{text.linksLabel}</p>
      {kinds.map((kind) => (
        <div key={kind} className="ps-link">
          <label className="pc-meta" htmlFor={`ps-link-${kind}`}>{text.siteLabels[kind] ?? kind}</label>
          <input
            id={`ps-link-${kind}`}
            type="url"
            inputMode="url"
            dir="ltr"
            className="pc-field"
            value={links[kind] ?? ""}
            maxLength={websiteMax * 2}
            placeholder="https://"
            onChange={(e) => setLinks((current) => ({ ...current, [kind]: e.target.value }))}
          />
        </div>
      ))}
      <p className="pc-meta">{text.linksHelp}</p>
      {verified ? <p className="pc-meta">{text.verifiedNote}</p> : null}

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
