"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import LoginNotice from "@/components/LoginNotice";
import { useLoggedOut } from "@/lib/use-logged-out";
import SocialLinkPreview from "@/components/social/SocialLinkPreview";
import { cleanTypedLink, findPostLink } from "@/lib/social-links";
import { createSocialPost } from "@/app/(site)/social/submit/actions";
import { REPLY_POLICIES, DEFAULT_REPLY_POLICY, type ReplyPolicy } from "@/lib/social-reply-control-rules";

export type SocialPostFormText = {
  title: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  submit: string;
  cancel: string;
  saving: string;
  error: string;
  invalid: string;
  link: string; // a web link needs reputation (reputationConfig.privileges.link)
  tooMany: string; // contains {minutes}
  duplicate: string; // the same text was already posted recently (SOCIAL_TODO C2)
  login: string;
  loginLink: string;
  imageAdd: string;
  imageRemove: string;
  imageHelp: string;
  imageType: string;
  imageSize: string;
  imagePixels: string;
  imagePreview: string;
  // Web addresses and YouTube (patch-social-links)
  linkAdd: string;
  linkField: string;
  linkPlaceholder: string;
  linkInsert: string;
  linkCancel: string;
  linkInvalid: string;
  linkHelp: string;
  linkPreview: string; // heading above the preview
  videoPlay: string;
  videoTitle: string;
  videoOpen: string;
  linkOpen: string; // contains {host}
  // Reply control (SOCIAL_TODO B9)
  replyLabel: string;
  replyHelp: string;
  replyEveryone: string;
  replyFollowing: string;
  replyMentioned: string;
};

type Failure = false | "error" | "login" | "invalid" | "link" | "tooMany" | "duplicate" | "imageType" | "imageSize" | "imagePixels";

export default function SocialPostForm({
  text,
  imageMaxBytes,
  imageTypes,
  initialBody = "",
}: {
  /** Text typed in the quick composer on /social (?body=...). */
  initialBody?: string;
  text: SocialPostFormText;
  /** The size limit of the picture, in bytes (the server checks it again). */
  imageMaxBytes: number;
  /** The picture types the file chooser offers (the server checks the real content again). */
  imageTypes: string[];
}) {
  const [body, setBody] = useState(initialBody);
  const [image, setImage] = useState<{ file: File; preview: string } | null>(null);
  const [replyPolicy, setReplyPolicy] = useState<ReplyPolicy>(DEFAULT_REPLY_POLICY);
  const [failed, setFailed] = useState<Failure>(false);
  const [waitMinutes, setWaitMinutes] = useState(1);
  const [pending, startTransition] = useTransition();
  const loggedOut = useLoggedOut();
  const fileInput = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkBad, setLinkBad] = useState(false);
  const link = useMemo(() => findPostLink(body), [body]); // the first web address in the text: shown below as a preview
  const previewUrl = useRef<string | null>(null); // the address of the preview now shown: released when it is replaced or removed

  const canPost = body.trim().length > 0 && body.trim().length <= 5000
    && !pending && !loggedOut;

  function clearImage() {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setImage(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function insertLink() {
    const address = cleanTypedLink(linkText);
    if (!address) {
      setLinkBad(true);
      return;
    }
    // The address goes into the text (that is where it is saved): on its own line at the end, within the 5000 limit.
    const next = body.trim() === "" ? address : `${body.replace(/\s+$/u, "")}\n${address}`;
    if (next.length > 5000) {
      setLinkBad(true);
      return;
    }
    setBody(next);
    setLinkText("");
    setLinkBad(false);
    setLinkOpen(false);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Quick checks so a person does not wait for an upload that will be refused. The server checks everything again.
    if (!imageTypes.includes(file.type)) {
      clearImage();
      setFailed("imageType");
      return;
    }
    if (file.size > imageMaxBytes) {
      clearImage();
      setFailed("imageSize");
      return;
    }
    setFailed(false);
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = URL.createObjectURL(file);
    setImage({ file, preview: previewUrl.current });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPost) return;

    setFailed(false);
    startTransition(async () => {
      const form = new FormData();
      form.set("body", body);
      form.set("replyPolicy", replyPolicy);
      if (image) form.set("image", image.file);
      const result = await createSocialPost(form);
      if (result?.error) {
        if (result.tooMany) setWaitMinutes(result.waitMinutes ?? 1);
        setFailed(
          result.login
            ? "login"
            : result.tooMany
              ? "tooMany"
              : result.duplicate
              ? "duplicate"
              : result.imageError === "size"
                ? "imageSize"
                : result.imageError === "pixels"
                  ? "imagePixels"
                  : result.imageError === "type"
                    ? "imageType"
                    : result.invalid
                      ? "invalid"
                      : result.link
                        ? "link"
                        : "error",
        );
      }
    });
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

        <label className="sf-label" htmlFor="social-body">
          {text.bodyLabel}
        </label>

        <textarea
          id="social-body"
          className="pc-field"
          rows={8}
          maxLength={5000}
          value={body}
          disabled={loggedOut}
          placeholder={text.bodyPlaceholder}
          onChange={(e) => setBody(e.target.value)}
        />

        <div className="sp-counter">{body.length}/5000</div>

        <div className="sf-link">
          <div className="sf-imageRow">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={loggedOut || pending}
              aria-expanded={linkOpen}
              onClick={() => setLinkOpen((open) => !open)}
            >
              🔗 {text.linkAdd}
            </button>
          </div>
          {linkOpen && (
            <div className="sf-linkRow">
              <input
                type="url"
                inputMode="url"
                className="pc-field sf-linkField"
                value={linkText}
                maxLength={2000}
                autoFocus
                aria-label={text.linkField}
                aria-invalid={linkBad}
                placeholder={text.linkPlaceholder}
                disabled={loggedOut || pending}
                onChange={(e) => {
                  setLinkText(e.target.value);
                  setLinkBad(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault(); // Enter adds the link; it does not send the post
                    insertLink();
                  }
                }}
              />
              <button type="button" className="btn btn-primary" disabled={pending || linkText.trim() === ""} onClick={insertLink}>
                {text.linkInsert}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setLinkOpen(false);
                  setLinkText("");
                  setLinkBad(false);
                }}
              >
                {text.linkCancel}
              </button>
            </div>
          )}
          {linkOpen && linkBad && (
            <div className="notice notice-danger" role="alert">
              {text.linkInvalid}
            </div>
          )}
          <p className="sf-imageHelp">{text.linkHelp}</p>
          {link && (
            <div className="sf-linkPreview">
              <div className="sf-linkPreviewTitle">{text.linkPreview}</div>
              <SocialLinkPreview
                link={link}
                text={{ play: text.videoPlay, title: text.videoTitle, open: text.videoOpen, linkLabel: text.linkOpen }}
              />
            </div>
          )}
        </div>

        <div className="sf-image">
          <input
            ref={fileInput}
            id="social-image"
            type="file"
            accept={imageTypes.join(",")}
            hidden
            disabled={loggedOut || pending}
            onChange={onPick}
          />
          <div className="sf-imageRow">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={loggedOut || pending}
              onClick={() => fileInput.current?.click()}
            >
              🖼️ {text.imageAdd}
            </button>
            {image && (
              <button type="button" className="btn btn-ghost" disabled={pending} onClick={clearImage}>
                {text.imageRemove}
              </button>
            )}
          </div>
          <p className="sf-imageHelp">{text.imageHelp}</p>
          {image && (
            <div className="sp-media">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen file (blob address) */}
              <img src={image.preview} alt={text.imagePreview} />
            </div>
          )}
        </div>

        <div className="sf-reply">
          <label className="sf-label" htmlFor="social-reply-policy">{text.replyLabel}</label>
          <select
            id="social-reply-policy"
            className="pc-field"
            value={replyPolicy}
            disabled={loggedOut || pending}
            onChange={(e) => setReplyPolicy(e.target.value as ReplyPolicy)}
          >
            {REPLY_POLICIES.map((policy) => (
              <option key={policy} value={policy}>
                {policy === "EVERYONE" ? text.replyEveryone : policy === "FOLLOWING" ? text.replyFollowing : text.replyMentioned}
              </option>
            ))}
          </select>
          <p className="sf-imageHelp">{text.replyHelp}</p>
        </div>

        {failed && (
          <div className="notice notice-danger" role="alert">
            {failed === "login"
              ? <LoginNotice text={{ message: text.login, link: text.loginLink }} />
              : failed === "tooMany"
                ? text.tooMany.replace("{minutes}", String(waitMinutes))
                : failed === "duplicate"
                ? text.duplicate
                : failed === "imageType"
                  ? text.imageType
                  : failed === "imageSize"
                    ? text.imageSize
                    : failed === "imagePixels"
                      ? text.imagePixels
                      : failed === "invalid"
                        ? text.invalid
                        : failed === "link"
                          ? text.link
                          : text.error}
          </div>
        )}

        <div className="sf-actions">
          <Link href="/" className="btn btn-secondary btn-lg">
            {text.cancel}
          </Link>
          <button type="submit" className="btn btn-primary btn-lg" disabled={!canPost}>
            {pending ? text.saving : text.submit}
          </button>
        </div>
      </section>
    </form>
  );
}
