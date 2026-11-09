"use client";

// The upload form of /photos/upload (PHOTO_TODO 4), now with MULTIPLE upload (stage 1).
//  - The person picks up to `batchMax` photos; each gets a small preview and can be removed before sending.
//  - Title, caption, category and tags are typed ONCE and used for every photo of the batch.
//  - The photos are sent ONE BY ONE to the same server action as before (uploadPhoto), so one bad photo never spoils the
//    others, the progress is exact, and only the photos that failed need to be sent again ("Try again").
//  - The same file picked twice (same name, size and date) is ignored.
//  - Quick checks here only save a wasted upload; the server action checks everything again.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LoginNotice from "@/components/LoginNotice";
import { useLoggedOut } from "@/lib/use-logged-out";
import { photoThumbUrl } from "@/lib/photo-file";
import { uploadPhoto } from "@/app/(site)/photos/upload/actions";

export type PhotoUploadFormText = {
  title: string;
  choose: string;
  change: string;
  help: string;
  typeError: string;
  sizeError: string;
  pixelsError: string;
  noImage: string;
  preview: string;
  titleLabel: string;
  titleHelp: string;
  captionLabel: string;
  captionPlaceholder: string;
  categoryLabel: string;
  categoryPlaceholder: string;
  categoryRequired: string;
  tagsLabel: string;
  tagsHelp: string;
  rules: string;
  submit: string;
  saving: string;
  cancel: string;
  error: string;
  titleRequired: string;
  invalid: string;
  tagsInvalid: string;
  tooMany: string; // contains {minutes}
  done: string;
  another: string;
  login: string;
  loginLink: string;
  // --- multiple upload (stage 1). English for now; the 6 language files get these keys later. ---
  chooseMore: string;
  count: string; // {count} {max}
  remove: string;
  sameInfo: string;
  overLimit: string; // {max}
  duplicateSkipped: string; // {count}
  progress: string; // {done} {total}
  itemDone: string;
  itemFailed: string;
  retry: string; // button after some photos failed
  partlyDone: string; // {ok} {failed}
  doneMany: string; // {count}
  // --- stage 2: an own title for one photo ---
  ownTitle: string; // placeholder of the small title box under each photo
};

type Reason = "error" | "login" | "title" | "invalid" | "category" | "tags" | "noImage" | "tooMany" | "imageType" | "imageSize" | "imagePixels";
type Status = "ready" | "sending" | "done" | "failed";
type Item = { id: string; file: File; preview: string; status: Status; reason?: Reason; stored?: string; ownTitle: string };

// Reasons that belong to ONE photo (the others are about the form or the account and stop the whole batch).
const PER_PHOTO: Reason[] = ["imageType", "imageSize", "imagePixels", "error", "noImage"];

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, String(value)), template);
}

export default function PhotoUploadForm({
  text,
  imageMaxBytes,
  imageTypes,
  titleMax,
  captionMax,
  categories,
  batchMax,
}: {
  text: PhotoUploadFormText;
  /** The size limit of ONE photo, in bytes (the server checks it again). */
  imageMaxBytes: number;
  /** The types the file chooser offers (the server checks the real content again). */
  imageTypes: string[];
  titleMax: number;
  captionMax: number;
  /** The categories to choose from: the stored key and the visible name. */
  categories: { value: string; label: string }[];
  /** How many photos one upload takes (photoMedia.batchMax). */
  batchMax: number;
}) {
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [failed, setFailed] = useState<false | Reason>(false); // a problem with the form / account (stops the batch)
  const [notice, setNotice] = useState<string | null>(null); // "3 skipped" and similar, not an error
  const [waitMinutes, setWaitMinutes] = useState(1);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false); // everything uploaded -> show the thank-you screen
  const loggedOut = useLoggedOut();
  const fileInput = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Release every preview address when the page is left.
  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) URL.revokeObjectURL(item.preview);
    };
  }, []);

  const toSend = items.filter((item) => item.status === "ready" || item.status === "failed");
  const doneCount = items.filter((item) => item.status === "done").length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  // Every photo needs a title: its own (stage 2) or the shared one.
  const everyHasTitle = toSend.every((item) => (item.ownTitle.trim() || title.trim()).length > 0);
  const canSend = !busy && !loggedOut && toSend.length > 0 && everyHasTitle && category !== "";
  const hasFailed = failedCount > 0;

  function update(id: string, patch: Partial<Item>) {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (fileInput.current) fileInput.current.value = ""; // so the same file can be chosen again later
    if (picked.length === 0) return;
    setFailed(false);

    const known = new Set(itemsRef.current.map((item) => `${item.file.name}|${item.file.size}|${item.file.lastModified}`));
    const added: Item[] = [];
    let duplicates = 0;
    let overLimit = false;
    let badType = false;
    let badSize = false;
    for (const file of picked) {
      const key = `${file.name}|${file.size}|${file.lastModified}`;
      if (known.has(key)) {
        duplicates += 1;
        continue;
      }
      if (!imageTypes.includes(file.type)) {
        badType = true;
        continue;
      }
      if (file.size > imageMaxBytes) {
        badSize = true;
        continue;
      }
      if (itemsRef.current.length + added.length >= batchMax) {
        overLimit = true;
        continue;
      }
      known.add(key);
      added.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, preview: URL.createObjectURL(file), status: "ready", ownTitle: "" });
    }
    if (added.length > 0) setItems((list) => [...list, ...added]);

    const notes: string[] = [];
    if (overLimit) notes.push(fill(text.overLimit, { max: batchMax }));
    if (duplicates > 0) notes.push(fill(text.duplicateSkipped, { count: duplicates }));
    if (badType) notes.push(text.typeError);
    if (badSize) notes.push(text.sizeError);
    setNotice(notes.length > 0 ? notes.join(" ") : null);
  }

  function removeItem(id: string) {
    if (busy) return;
    const item = itemsRef.current.find((entry) => entry.id === id);
    if (item) URL.revokeObjectURL(item.preview);
    setItems((list) => list.filter((entry) => entry.id !== id));
    setNotice(null);
  }

  function reset() {
    for (const item of itemsRef.current) URL.revokeObjectURL(item.preview);
    setItems([]);
    setTitle("");
    setCaption("");
    setCategory("");
    setTags("");
    setFailed(false);
    setNotice(null);
    setFinished(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setFailed(false);
    setNotice(null);
    setBusy(true);
    const doneNow = new Set<string>(); // the screen has not re-drawn yet inside the loop, so the results are also kept here
    try {
      const queue = itemsRef.current.filter((item) => item.status === "ready" || item.status === "failed");
      for (const item of queue) {
        update(item.id, { status: "sending", reason: undefined });
        const form = new FormData();
        form.set("title", item.ownTitle.trim() || title);
        form.set("caption", caption);
        form.set("category", category);
        form.set("tags", tags);
        form.set("image", item.file);
        let result;
        try {
          result = await uploadPhoto(form);
        } catch {
          result = { ok: false as const, reason: "error" as const };
        }
        if (result.ok) {
          update(item.id, { status: "done", stored: result.file });
          doneNow.add(item.id);
          continue;
        }
        if (PER_PHOTO.includes(result.reason)) {
          update(item.id, { status: "failed", reason: result.reason });
          continue; // the next photos may be fine
        }
        // Form, login or rate-limit problem: stop here, the rest stays ready.
        update(item.id, { status: "ready" });
        if (result.reason === "tooMany") setWaitMinutes(result.waitMinutes ?? 1);
        setFailed(result.reason);
        return;
      }
    } finally {
      setBusy(false);
    }
    // Reached the end of the queue: if nothing failed, show the thank-you screen.
    if (itemsRef.current.every((item) => item.status === "done" || doneNow.has(item.id))) setFinished(true);
  }

  function reasonText(reason: Reason | undefined): string {
    if (reason === "imageType") return text.typeError;
    if (reason === "imageSize") return text.sizeError;
    if (reason === "imagePixels") return text.pixelsError;
    if (reason === "noImage") return text.noImage;
    return text.error;
  }

  if (finished) {
    const stored = items.filter((item) => item.stored);
    return (
      <div className="sf-wrap">
        <section className="card sf-card">
          <h1 className="sf-h1">{text.title}</h1>
          <div className="notice" role="status">
            {stored.length > 1 ? fill(text.doneMany, { count: stored.length }) : text.done}
          </div>
          <div className="sp-batchGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
            {stored.map((item) => (
              <div className="sp-media" key={item.id} style={{ aspectRatio: "1 / 1", overflow: "hidden", borderRadius: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- the small copy we just stored, served by our own media route */}
                <img
                  src={photoThumbUrl(item.stored as string)}
                  alt={item.ownTitle.trim() || title || text.preview}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
            ))}
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

  return (
    <form onSubmit={onSubmit} className="sf-wrap">
      <section className="card sf-card">
        <h1 className="sf-h1">{text.title}</h1>

        {loggedOut && (
          <div className="notice notice-danger" role="status">
            <LoginNotice text={{ message: text.login, link: text.loginLink }} />
          </div>
        )}

        <div className="sf-image">
          <input
            ref={fileInput}
            id="photo-image"
            type="file"
            multiple
            accept={imageTypes.join(",")}
            hidden
            disabled={loggedOut || busy}
            onChange={onPick}
          />
          <div className="sf-imageRow">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={loggedOut || busy || items.length >= batchMax}
              onClick={() => fileInput.current?.click()}
            >
              🖼️ {items.length > 0 ? text.chooseMore : text.choose}
            </button>
            {items.length > 0 && <span className="sf-imageHelp">{fill(text.count, { count: items.length, max: batchMax })}</span>}
          </div>
          <p className="sf-imageHelp">{text.help}</p>
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}

          {items.length > 0 && (
            <ul className="sp-batchGrid" style={{ listStyle: "none", padding: 0, margin: "12px 0", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
              {items.map((item) => (
                <li key={item.id} className="sp-batchItem" style={{ position: "relative", display: "grid", alignContent: "start", gap: 4 }}>
                  <div className="sp-media" style={{ aspectRatio: "1 / 1", overflow: "hidden", borderRadius: 12, width: "100%" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen file (blob address) */}
                    <img
                      src={item.preview}
                      alt={text.preview}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: item.status === "sending" ? 0.5 : 1 }}
                    />
                  </div>
                  {!busy && item.status !== "done" && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      aria-label={text.remove}
                      title={text.remove}
                      onClick={() => removeItem(item.id)}
                      style={{ position: "absolute", top: 4, right: 4, padding: "0 8px" }}
                    >
                      ✕
                    </button>
                  )}
                  {(item.status === "ready" || item.status === "failed") && (
                    <input
                      type="text"
                      className="pc-field"
                      maxLength={titleMax}
                      value={item.ownTitle}
                      disabled={loggedOut || busy}
                      placeholder={text.ownTitle}
                      aria-label={text.ownTitle}
                      style={{ marginTop: 6, padding: "8px 12px", fontSize: 14, borderRadius: 10, width: "100%" }}
                      onChange={(e) => update(item.id, { ownTitle: e.target.value })}
                    />
                  )}
                  {item.status === "sending" && <div className="sf-imageHelp">⏳ {text.saving}</div>}
                  {item.status === "done" && <div className="sf-imageHelp">✅ {text.itemDone}</div>}
                  {item.status === "failed" && (
                    <div className="sf-imageHelp" role="alert">
                      ❌ {text.itemFailed}: {reasonText(item.reason)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {busy && (
            <div className="notice" role="status">
              {fill(text.progress, { done: doneCount, total: items.length })}
            </div>
          )}
          {!busy && hasFailed && (
            <div className="notice notice-danger" role="alert">
              {fill(text.partlyDone, { ok: doneCount, failed: failedCount })}
            </div>
          )}
        </div>

        {items.length > 1 && <p className="sf-imageHelp">{text.sameInfo}</p>}

        <label className="sf-label" htmlFor="photo-title">
          {text.titleLabel}
        </label>
        <input
          id="photo-title"
          type="text"
          className="pc-field"
          maxLength={titleMax}
          value={title}
          disabled={loggedOut || busy}
          onChange={(e) => setTitle(e.target.value)}
        />
        <p className="sf-imageHelp">{text.titleHelp}</p>

        <label className="sf-label" htmlFor="photo-caption">
          {text.captionLabel}
        </label>
        <textarea
          id="photo-caption"
          className="pc-field"
          rows={4}
          maxLength={captionMax}
          value={caption}
          disabled={loggedOut || busy}
          placeholder={text.captionPlaceholder}
          onChange={(e) => setCaption(e.target.value)}
        />
        <div className="sp-counter">
          {caption.length}/{captionMax}
        </div>

        <label className="sf-label" htmlFor="photo-category">
          {text.categoryLabel}
        </label>
        <select
          id="photo-category"
          className="pc-field"
          value={category}
          disabled={loggedOut || busy}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">{text.categoryPlaceholder}</option>
          {categories.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <label className="sf-label" htmlFor="photo-tags">
          {text.tagsLabel}
        </label>
        <input
          id="photo-tags"
          type="text"
          className="pc-field"
          maxLength={500}
          value={tags}
          disabled={loggedOut || busy}
          onChange={(e) => setTags(e.target.value)}
        />
        <p className="sf-imageHelp">{text.tagsHelp}</p>

        <p className="sf-imageHelp">{text.rules}</p>

        {failed && (
          <div className="notice notice-danger" role="alert">
            {failed === "login" ? (
              <LoginNotice text={{ message: text.login, link: text.loginLink }} />
            ) : failed === "tooMany" ? (
              text.tooMany.replace("{minutes}", String(waitMinutes))
            ) : failed === "title" ? (
              text.titleRequired
            ) : failed === "category" ? (
              text.categoryRequired
            ) : failed === "tags" ? (
              text.tagsInvalid
            ) : failed === "invalid" ? (
              text.invalid
            ) : (
              reasonText(failed)
            )}
          </div>
        )}

        <div className="sf-actions">
          <Link href="/" className="btn btn-secondary btn-lg">
            {text.cancel}
          </Link>
          <button type="submit" className="btn btn-primary btn-lg" disabled={!canSend}>
            {busy ? text.saving : hasFailed ? text.retry : text.submit}
          </button>
        </div>
      </section>
    </form>
  );
}
