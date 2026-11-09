"use client";
// Approve / Reject buttons under one community request. Reject needs a written reason.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideCommunityRequest } from "@/app/admin/communities/requests/actions";
import type { crText } from "@/lib/community-request-text";

export default function CommunityRequestDecision({ id, text }: { id: number; text: typeof crText }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(kind: "approve" | "reject") {
    setError(null);
    start(async () => {
      const result = await decideCommunityRequest({ id, kind, note });
      if ("error" in result) {
        setError(text.errors[result.error] ?? text.errors.other);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rejecting && (
        <>
          <label className="sf-label" htmlFor={`cr-note-${id}`}>{text.admin.noteLabel}</label>
          <textarea id={`cr-note-${id}`} className="pc-field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </>
      )}
      {error && <div className="notice notice-danger" role="alert">{error}</div>}
      <div className="pc-actions">
        <button type="button" className="pc-btn" disabled={pending} onClick={() => run("approve")}>
          {pending ? text.admin.working : text.admin.approve}
        </button>
        {rejecting ? (
          <button type="button" className="pc-pill" disabled={pending} onClick={() => run("reject")}>{text.admin.reject}</button>
        ) : (
          <button type="button" className="pc-pill" disabled={pending} onClick={() => setRejecting(true)}>{text.admin.reject}</button>
        )}
      </div>
    </div>
  );
}
