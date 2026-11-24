"use client";

// The upload form of /shorts/upload (SHORTS_TODO 17-18). Quick checks here (type, size, length) only save the person a
// wasted upload; the server action (uploadShort) checks everything again, and the server is the only judge of the length.
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import LoginNotice from "@/components/LoginNotice";
import { useLoggedOut } from "@/lib/use-logged-out";
import { uploadShort } from "@/app/(site)/shorts/upload/actions";
import type { ShortText } from "@/config/short-text";

type Text = ShortText & { login: string; loginLink: string };

type Failure =
  | false
  | "error" | "login" | "link" | "title" | "invalid" | "privacy" | "noVideo" | "tooMany" | "busy"
  | "videoType" | "videoSize" | "tooShort" | "tooLong" | "noFfmpeg" | "processing";

const PRIVACY: { value: "PUBLIC" | "UNLISTED" | "PRIVATE"; label: keyof Text; help: keyof Text }[] = [
  { value: "PUBLIC", label: "privacyPublic", help: "privacyPublicHelp" },
  { value: "UNLISTED", label: "privacyUnlisted", help: "privacyUnlistedHelp" },
  { value: "PRIVATE", label: "privacyPrivate", help: "privacyPrivateHelp" },
];

export default function ShortUploadForm({
  text,
  maxBytes,
  minSeconds,
  maxSeconds,
  videoTypes,
  titleMax,
  descriptionMax,
}: {
  text: Text;
  maxBytes: number;
  minSeconds: number;
  maxSeconds: number;
  videoTypes: string[];
  titleMax: number;
  descriptionMax: number;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<"PUBLIC" | "UNLISTED" | "PRIVATE">("PUBLIC");
  const [video, setVideo] = useState<{ file: File; preview: string } | null>(null);
  const [failed, setFailed] = useState<Failure>(false);
  const [waitMinutes, setWaitMinutes] = useState(1);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const loggedOut = useLoggedOut();
  const fileInput = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null); // released when it is replaced or removed

  const canSend = !pending && !loggedOut && video !== null && title.trim().length > 0;

  function clearVideo() {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setVideo(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!videoTypes.includes(file.type)) {
      clearVideo();
      setFailed("videoType");
      return;
    }
    if (file.size > maxBytes) {
      clearVideo();
      setFailed("videoSize");
      return;
    }
    setFailed(false);
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = URL.createObjectURL(file);
    setVideo({ file, preview: previewUrl.current });
  }

  // Quick length check in the browser (only a hint; if the browser cannot read the file we simply let the server decide).
  function onMetadata(e: React.SyntheticEvent<HTMLVideoElement>) {
    const seconds = e.currentTarget.duration;
    if (!Number.isFinite(seconds)) return;
    if (seconds < minSeconds - 1) {
      clearVideo();
      setFailed("tooShort");
    } else if (seconds > maxSeconds + 1) {
      clearVideo();
      setFailed("tooLong");
    }
  }

  function reset() {
    clearVideo();
    setTitle("");
    setDescription("");
    setPrivacy("PUBLIC");
    setFailed(false);
    setDone(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend || !video) return;
    setFailed(false);
    startTransition(async () => {
      const form = new FormData();
      form.set("title", title);
      form.set("description", description);
      form.set("privacy", privacy);
      form.set("video", video.file);
      try {
        const result = await uploadShort(form);
        if (result.ok) {
          clearVideo();
          setDone(true);
          return;
        }
        if (result.reason === "tooMany") setWaitMinutes(result.waitMinutes ?? 1);
        setFailed(result.reason);
      } catch {
        setFailed("error"); // the connection broke or the file was refused before it reached the action
      }
    });
  }

  if (done) {
    return (
      <div className="sf-wrap">
        <section className="card sf-card">
          <h1 className="sf-h1">{text.uploadTitle}</h1>
          <div className="notice" role="status">
            {text.done}
          </div>
          <div className="sf-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={reset}>
              {text.another}
            </button>
          </div>
        </section>
      </div>
    );
  }

  const message: Record<Exclude<Failure, false | "login" | "tooMany">, string> = {
    error: text.error,
    title: text.titleRequired,
    invalid: text.invalid,
    link: text.linkError,
    privacy: text.invalid,
    noVideo: text.noVideo,
    busy: text.busy,
    videoType: text.typeError,
    videoSize: text.sizeError,
    tooShort: text.tooShortError,
    tooLong: text.tooLongError,
    noFfmpeg: text.noFfmpeg,
    processing: text.processing,
  };

  return (
    <form onSubmit={onSubmit} className="sf-wrap">
      <section className="card sf-card">
        <h1 className="sf-h1">{text.uploadTitle}</h1>

        {loggedOut && (
          <div className="notice notice-danger" role="status">
            <LoginNotice text={{ message: text.login, link: text.loginLink }} />
          </div>
        )}

        <div className="sf-image">
          <input
            ref={fileInput}
            id="short-video"
            type="file"
            accept={videoTypes.join(",")}
            hidden
            disabled={loggedOut || pending}
            onChange={onPick}
          />
          <div className="sf-imageRow">
            <button type="button" className="btn btn-secondary" disabled={loggedOut || pending} onClick={() => fileInput.current?.click()}>
              🎬 {video ? text.change : text.choose}
            </button>
          </div>
          <p className="sf-imageHelp">{text.help}</p>
          {video && (
            <div className="sp-media">
              <video src={video.preview} controls muted playsInline preload="metadata" onLoadedMetadata={onMetadata} aria-label={text.preview} style={{ maxHeight: "60vh", maxWidth: "100%" }} />
            </div>
          )}
        </div>

        <label className="sf-label" htmlFor="short-title">
          {text.titleLabel}
        </label>
        <input
          id="short-title"
          type="text"
          className="pc-field"
          maxLength={titleMax}
          value={title}
          disabled={loggedOut || pending}
          onChange={(e) => setTitle(e.target.value)}
        />
        <p className="sf-imageHelp">{text.titleHelp}</p>

        <label className="sf-label" htmlFor="short-description">
          {text.descriptionLabel}
        </label>
        <textarea
          id="short-description"
          className="pc-field"
          rows={4}
          maxLength={descriptionMax}
          value={description}
          disabled={loggedOut || pending}
          placeholder={text.descriptionPlaceholder}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="sp-counter">
          {description.length}/{descriptionMax}
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: "12px 0 0" }} disabled={loggedOut || pending}>
          <legend className="sf-label">{text.privacyLabel}</legend>
          {PRIVACY.map((option) => (
            <label key={option.value} style={{ display: "block", margin: "6px 0" }}>
              <input
                type="radio"
                name="short-privacy"
                value={option.value}
                checked={privacy === option.value}
                onChange={() => setPrivacy(option.value)}
              />{" "}
              <strong>{text[option.label]}</strong> <span className="sf-imageHelp">{text[option.help]}</span>
            </label>
          ))}
        </fieldset>

        <p className="sf-imageHelp">{text.rules}</p>

        {pending && (
          <div className="notice" role="status">
            {text.saving}
          </div>
        )}

        {failed && (
          <div className="notice notice-danger" role="alert">
            {failed === "login" ? (
              <LoginNotice text={{ message: text.login, link: text.loginLink }} />
            ) : failed === "tooMany" ? (
              text.tooMany.replace("{minutes}", String(waitMinutes))
            ) : (
              message[failed]
            )}
          </div>
        )}

        <div className="sf-actions">
          <Link href="/" className="btn btn-secondary btn-lg">
            {text.cancel}
          </Link>
          <button type="submit" className="btn btn-primary btn-lg" disabled={!canSend}>
            {pending ? "…" : text.submit}
          </button>
        </div>
      </section>
    </form>
  );
}
