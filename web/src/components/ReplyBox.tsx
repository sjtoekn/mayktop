"use client";

import { useState } from "react";
import Icon from "@/components/shell/Icon";
import CommentForm, { type CommentFormText } from "@/components/CommentForm";

/**
 * The action row under a comment (the vote count comes in as children) with a Reply button
 * that opens a small comment box for answering that comment.
 */
export default function ReplyBox({
  postId,
  parentId,
  replyLabel,
  text,
  children,
}: {
  postId: number;
  parentId: number;
  replyLabel: string;
  text: CommentFormText;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="pc-actions">
        {children}
        <button
          type="button"
          className="pc-pill pc-pill-sm"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name="comment" size={16} /> {replyLabel}
        </button>
      </div>
      {open && (
        <CommentForm
          postId={postId}
          parentId={parentId}
          text={text}
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
