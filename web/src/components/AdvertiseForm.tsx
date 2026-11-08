"use client";

// The "Create an ad" form (ADS_PLAN Session 3). All visible text comes in as props (translated on the server
// with t()), so this file holds no hard-coded words. The server checks everything again (src/lib/ad-input.ts):
// what is checked here is only for the person's comfort. TEXT, IMAGE and VIDEO ads can be sent (Session 3b): a picture
// (or the poster of a video) and a video travel with the form as files. The files are checked again on the server by
// their real content (src/lib/ad-media.ts). Nothing is uploaded until the person presses "send".
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createAd } from "@/app/(site)/advertise/new/actions";
import AdMedia from "@/components/AdMedia";
import "@/components/ad-social.css";

type Format = "TEXT" | "IMAGE" | "VIDEO";
type Slot = "SIDEBAR" | "FEED" | "SOCIAL_FEED";

export type AdvertiseText = {
  title: string;
  intro: string;
  format: string;
  formatNames: Record<Format, string>;
  formatSoon: string; // "coming next"
  slot: string;
  slotNames: Record<Slot, string>;
  slotSocialNote: string; // shown instead of the page choice when the Social feed slot is chosen
  where: string;
  whereAny: string;
  fieldTitle: string;
  fieldBody: string;
  fieldUrl: string;
  fieldUrlHint: string;
  fieldEmail: string;
  fieldEmailHint: string;
  fieldStart: string;
  fieldStartHint: string;
  fieldImage: string; // the picture of an image ad
  fieldImageHint: string;
  fieldPoster: string; // the poster picture of a video ad
  fieldPosterHint: string;
  fieldVideo: string;
  fieldVideoHint: string;
  previewNoFile: string; // shown in the preview before a file is chosen
  previewTitle: string;
  previewBadge: string; // the visible "Ad" badge
  previewLabel: string; // aria-label of the preview box
  priceLine: string;
  agree: string;
  rulesLink: string; // "Read the ad rules"
  submit: string;
  saving: string;
  cancel: string;
  login: string;
  loginLink: string;
  sentTitle: string;
  sentBody: string; // contains {id} and {email}
  sentAnother: string;
  sentHome: string;
  errors: Record<string, string>; // by error code; "words" contains {phrase}
};

const FORMATS: Format[] = ["TEXT", "IMAGE", "VIDEO"];
const SLOTS: Slot[] = ["SIDEBAR", "FEED", "SOCIAL_FEED"];

function hostOf(url: string): string {
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" ? u.host : "";
  } catch {
    return "";
  }
}

export default function AdvertiseForm({
  communities,
  initialEmail,
  limits,
  openFormats,
  text,
}: {
  communities: { slug: string; name: string }[];
  initialEmail: string;
  limits: { titleMax: number; bodyMax: number; dateMin: string; dateMax: string; imageMaxBytes: number; videoMaxBytes: number };
  openFormats: string[];
  text: AdvertiseText;
}) {
  const [format, setFormat] = useState<Format>("TEXT");
  const [slot, setSlot] = useState<Slot>("SIDEBAR");
  const [community, setCommunity] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [start, setStart] = useState("");
  const [agree, setAgree] = useState(false);
  const [image, setImage] = useState<File | null>(null); // the picture, or the poster of a video ad
  const [video, setVideo] = useState<File | null>(null);
  const [error, setError] = useState<{ key: string; phrase?: string } | null>(null);
  const [sent, setSent] = useState<{ id: number; email: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Local preview addresses (blob:) of the chosen files. They exist only in this browser tab; nothing is sent yet.
  // Created in the event handlers below (never while rendering) and released when replaced or when the form closes.
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const previews = useRef<{ image: string | null; video: string | null }>({ image: null, video: null });
  useEffect(() => {
    const held = previews.current;
    return () => {
      if (held.image) URL.revokeObjectURL(held.image);
      if (held.video) URL.revokeObjectURL(held.video);
    };
  }, []);

  function pickFile(kind: "image" | "video", file: File | null) {
    const old = previews.current[kind];
    if (old) URL.revokeObjectURL(old);
    const next = file ? URL.createObjectURL(file) : null;
    previews.current[kind] = next;
    if (kind === "image") {
      setImage(file);
      setImagePreview(next);
    } else {
      setVideo(file);
      setVideoPreview(next);
    }
  }

  const filesReady = format === "TEXT" || (image !== null && (format === "IMAGE" || video !== null));
  const ready =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    url.trim().length > 0 &&
    email.trim().length > 0 &&
    filesReady &&
    agree &&
    !pending;

  function reset() {
    setTitle("");
    setBody("");
    setUrl("");
    setStart("");
    setAgree(false);
    pickFile("image", null);
    pickFile("video", null);
    setError(null);
    setSent(null);
  }

  function chooseFormat(f: Format) {
    setFormat(f);
    setError(null);
    if (f === "TEXT") {
      pickFile("image", null);
      pickFile("video", null);
    } else if (f === "IMAGE") {
      pickFile("video", null);
    }
  }

  /** Quick check for the person's comfort (the server checks the real content). Returns the error code or null. */
  function sizeProblem(file: File | null, max: number): "media-size" | null {
    return file && file.size > max ? "media-size" : null;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    const tooBig = sizeProblem(image, limits.imageMaxBytes) ?? sizeProblem(video, limits.videoMaxBytes);
    if (tooBig) {
      setError({ key: tooBig });
      return;
    }
    setError(null);
    const form = new FormData();
    form.set("format", format);
    form.set("slot", slot);
    form.set("community", community);
    form.set("title", title);
    form.set("body", body);
    form.set("url", url);
    form.set("email", email);
    form.set("start", start);
    form.set("agree", agree ? "true" : "false");
    if (format !== "TEXT" && image) form.set("image", image);
    if (format === "VIDEO" && video) form.set("video", video);
    startTransition(async () => {
      const result = await createAd(form);
      if (result.ok) {
        setSent({ id: result.id, email: result.email });
      } else {
        setError({ key: result.error, phrase: "phrase" in result ? result.phrase : undefined });
      }
    });
  }

  if (sent) {
    return (
      <section className="card adv-card" role="status">
        <h1 className="adv-h1">{text.sentTitle}</h1>
        <p className="adv-text">{text.sentBody.replace("{id}", String(sent.id)).replace("{email}", sent.email)}</p>
        <div className="adv-actions">
          <Link href="/" className="btn btn-secondary btn-lg">
            {text.sentHome}
          </Link>
          <button type="button" className="btn btn-primary btn-lg" onClick={reset}>
            {text.sentAnother}
          </button>
        </div>
      </section>
    );
  }

  const host = hostOf(url);
  const errorText =
    error && error.key !== "login" ? (text.errors[error.key] ?? text.errors.other).replace("{phrase}", error.phrase ?? "") : "";

  return (
    <form onSubmit={onSubmit} className="adv-wrap">
      <section className="card adv-card">
        <h1 className="adv-h1">{text.title}</h1>
        <p className="adv-text">{text.intro}</p>

        <fieldset className="adv-fieldset">
          <legend className="adv-label">{text.format}</legend>
          <div className="adv-choices">
            {FORMATS.map((f) => {
              const open = openFormats.includes(f);
              return (
                <label key={f} className={`adv-choice${open ? "" : " adv-choice-off"}`}>
                  <input
                    type="radio"
                    name="format"
                    value={f}
                    checked={format === f}
                    disabled={!open}
                    onChange={() => chooseFormat(f)}
                  />
                  <span>
                    {text.formatNames[f]}
                    {!open && <span className="adv-soon"> · {text.formatSoon}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="adv-fieldset">
          <legend className="adv-label">{text.slot}</legend>
          <div className="adv-choices">
            {SLOTS.map((s) => (
              <label key={s} className="adv-choice">
                <input type="radio" name="slot" value={s} checked={slot === s} onChange={() => setSlot(s)} />
                <span>{text.slotNames[s]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {slot === "SOCIAL_FEED" ? (
          <p className="adv-hint">{text.slotSocialNote}</p>
        ) : (
          <>
            <label className="sf-label" htmlFor="adv-where">
              {text.where}
            </label>
            <select id="adv-where" className="pc-field" value={community} onChange={(e) => setCommunity(e.target.value)}>
              <option value="">{text.whereAny}</option>
              {communities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  c/{c.slug} · {c.name}
                </option>
              ))}
            </select>
          </>
        )}
      </section>

      <section className="card adv-card">
        <label className="sf-label" htmlFor="adv-title">
          {text.fieldTitle}
        </label>
        <input
          id="adv-title"
          className="pc-field"
          value={title}
          maxLength={limits.titleMax}
          onChange={(e) => setTitle(e.target.value)}
        />
        <span className="adv-count">
          {title.length}/{limits.titleMax}
        </span>

        <label className="sf-label" htmlFor="adv-body">
          {text.fieldBody}
        </label>
        <textarea
          id="adv-body"
          className="pc-field"
          rows={3}
          value={body}
          maxLength={limits.bodyMax}
          onChange={(e) => setBody(e.target.value)}
        />
        <span className="adv-count">
          {body.length}/{limits.bodyMax}
        </span>

        <label className="sf-label" htmlFor="adv-url">
          {text.fieldUrl}
        </label>
        <input
          id="adv-url"
          className="pc-field"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <p className="adv-hint">{text.fieldUrlHint}</p>

        <label className="sf-label" htmlFor="adv-email">
          {text.fieldEmail}
        </label>
        <input
          id="adv-email"
          className="pc-field"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="adv-hint">{text.fieldEmailHint}</p>

        <label className="sf-label" htmlFor="adv-start">
          {text.fieldStart}
        </label>
        <input
          id="adv-start"
          className="pc-field"
          type="date"
          min={limits.dateMin}
          max={limits.dateMax}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <p className="adv-hint">{text.fieldStartHint}</p>

        {format !== "TEXT" && (
          <>
            <label className="sf-label" htmlFor="adv-image">
              {format === "VIDEO" ? text.fieldPoster : text.fieldImage}
            </label>
            <input
              id="adv-image"
              className="pc-field"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => pickFile("image", e.target.files?.[0] ?? null)}
            />
            <p className="adv-hint">{format === "VIDEO" ? text.fieldPosterHint : text.fieldImageHint}</p>
          </>
        )}
        {format === "VIDEO" && (
          <>
            <label className="sf-label" htmlFor="adv-video">
              {text.fieldVideo}
            </label>
            <input
              id="adv-video"
              className="pc-field"
              type="file"
              accept="video/mp4,video/webm"
              onChange={(e) => pickFile("video", e.target.files?.[0] ?? null)}
            />
            <p className="adv-hint">{text.fieldVideoHint}</p>
          </>
        )}
      </section>

      <section className="card adv-card" aria-live="polite">
        <h2 className="sf-h2">{text.previewTitle}</h2>
        <div className={`adv-preview adv-preview-${slot}`}>
          <aside aria-label={text.previewLabel} className={`card card-ad ${slot === "SIDEBAR" ? "min-h-64" : "min-h-24"}${slot === "SOCIAL_FEED" ? " ad-social" : ""}`}>
            <div className="mb-2">
              <span className="badge badge-ad">{text.previewBadge}</span>
            </div>
            <AdMedia format={format} imageUrl={imagePreview} videoUrl={videoPreview} title={title} empty={text.previewNoFile} />
            <strong className={`type-heading mt-2 block${title ? "" : " text-muted"}`}>{title || text.fieldTitle}</strong>
            <p className={`type-small mt-1${body ? "" : " text-muted"}`}>{body || text.fieldBody}</p>
            {host && <span className="mt-2 block text-xs text-muted">{host}</span>}
          </aside>
        </div>
      </section>

      <section className="card adv-card">
        <p className="adv-price">{text.priceLine}</p>

        <label className="sf-agree">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            {text.agree}{" "}
            <Link href="/advertise#rules" className="underline">
              {text.rulesLink}
            </Link>
          </span>
        </label>

        {error && (
          <div className="notice notice-danger" role="alert">
            {error.key === "login" ? (
              <>
                {text.login}{" "}
                <Link href="/login" className="underline">
                  {text.loginLink}
                </Link>
              </>
            ) : (
              errorText
            )}
          </div>
        )}

        <div className="adv-actions">
          <Link href="/advertise" className="btn btn-secondary btn-lg">
            {text.cancel}
          </Link>
          <button type="submit" className="btn btn-primary btn-lg" disabled={!ready}>
            {pending ? text.saving : text.submit}
          </button>
        </div>
      </section>
    </form>
  );
}
