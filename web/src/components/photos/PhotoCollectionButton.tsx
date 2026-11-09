"use client";

// The Collection button of the photo page: opens a small panel with the person's collections (tick = this photo is in it),
// and a field to make a new one. Private. The server actions give the real state back.
import { useEffect, useRef, useState, useTransition } from "react";
import Icon from "@/components/shell/Icon";
import { createPhotoCollection, getPhotoCollections, togglePhotoInCollection } from "@/app/(site)/photos/collection/actions";
import type { PhotoCollectionRow } from "@/lib/photo-collection";

export type PhotoCollectionText = {
  label: string;
  title: string;
  heading: string;
  empty: string;
  newName: string;
  create: string;
  login: string;
  tooMany: string;
  full: string;
  exists: string;
  badName: string;
  error: string;
  loading: string;
};

export default function PhotoCollectionButton({ photoId, text }: { photoId: number; text: PhotoCollectionText }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PhotoCollectionRow[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function message(reason: string): string {
    if (reason === "login") return text.login;
    if (reason === "tooMany") return text.tooMany;
    if (reason === "full") return text.full;
    if (reason === "exists") return text.exists;
    if (reason === "badName") return text.badName;
    return text.error;
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    setError("");
    if (next) {
      startTransition(async () => {
        const result = await getPhotoCollections(photoId);
        if ("error" in result) {
          setError(message(result.reason));
          return;
        }
        setRows(result.collections);
      });
    }
  }

  function toggleRow(row: PhotoCollectionRow) {
    if (pending) return;
    setError("");
    startTransition(async () => {
      const result = await togglePhotoInCollection(row.id, photoId, !row.has);
      if ("error" in result) {
        setError(message(result.reason));
        return;
      }
      setRows((current) => (current ?? []).map((item) => (item.id === row.id ? { ...item, has: result.has } : item)));
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || name.trim() === "") return;
    setError("");
    startTransition(async () => {
      const result = await createPhotoCollection(photoId, name);
      if ("error" in result) {
        setError(message(result.reason));
        return;
      }
      setRows((current) => [result.collection, ...(current ?? [])]);
      setName("");
    });
  }

  return (
    <span className="ph-collWrap" ref={box}>
      <button type="button" className="pc-pill sp-bookmarkButton" onClick={toggleOpen} aria-expanded={open} title={text.title}>
        <Icon name="folderPlus" size={18} /> {text.label}
      </button>
      {open ? (
        <div className="ph-collPanel" role="dialog" aria-label={text.heading}>
          <b className="ph-collHeading">{text.heading}</b>
          {rows === null && error === "" ? <p className="ph-collNote">{text.loading}</p> : null}
          {rows !== null && rows.length === 0 ? <p className="ph-collNote">{text.empty}</p> : null}
          {rows !== null && rows.length > 0 ? (
            <ul className="ph-collList">
              {rows.map((row) => (
                <li key={row.id}>
                  <button type="button" className="ph-collRow" onClick={() => toggleRow(row)} disabled={pending} aria-pressed={row.has}>
                    <span className={`ph-collCheck${row.has ? " is-on" : ""}`} aria-hidden="true">{row.has ? "✓" : ""}</span>
                    <span className="ph-collName">{row.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <form className="ph-collForm" onSubmit={submit}>
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder={text.newName} aria-label={text.newName} />
            <button type="submit" className="btn btn-primary" disabled={pending || name.trim() === ""}>{text.create}</button>
          </form>
          {error ? <p className="ph-collNote" role="status">{error}</p> : null}
        </div>
      ) : null}
    </span>
  );
}
