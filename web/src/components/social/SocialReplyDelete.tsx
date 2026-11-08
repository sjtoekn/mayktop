"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSocialReply } from "@/app/(site)/social/reply/actions";
import "@/app/(site)/manage/owner.css";

// All visible text comes in as props (translated on the server). Shown ONLY under your own reply; the server checks again.
export type SocialReplyDeleteText = { delete: string; confirm: string; yes: string; no: string; error: string };

export default function SocialReplyDelete({ id, text }: { id: number; text: SocialReplyDeleteText }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function remove() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      const result = await deleteSocialReply({ id });
      if ("error" in result) {
        setError(text.error);
        setAsking(false);
        return;
      }
      router.refresh();
    });
  }

  if (!asking) {
    return (
      <span className="sp-likeWrap">
        <button type="button" className="pc-pill pc-pill-sm" onClick={() => { setError(""); setAsking(true); }}>{text.delete}</button>
        {error && <span className="sp-likeError" role="alert">{error}</span>}
      </span>
    );
  }
  return (
    <span className="oa-form">
      <span>{text.confirm}</span>
      <span className="oa-buttons">
        <button type="button" className="pc-pill pc-pill-sm" disabled={pending} onClick={() => setAsking(false)}>{text.no}</button>
        <button type="button" className="pc-btn pc-btn-sm" disabled={pending} onClick={remove}>{text.yes}</button>
      </span>
    </span>
  );
}
