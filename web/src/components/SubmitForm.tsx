"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import LoginNotice from "@/components/LoginNotice";
import { useLoggedOut } from "@/lib/use-logged-out";
import { createPost } from "@/app/(site)/submit/actions";
import { postKinds, postLimits, type PostKind } from "@/config/site";
import { checkPostInput, parseVideoUrl } from "@/lib/post-input-rules";
import { containsLink } from "@/lib/reputation-rules";

export type SubmitCommunity = {
  slug: string;
  name: string;
  rules: { title: string; text: string }[];
};

// All visible text comes in as props (translated on the server with t()),
// so this component contains no hard-coded words.
export type SubmitText = {
  title: string;
  communityLabel: string;
  communityChoose: string;
  rulesTitle: string; // contains {slug}
  rulesIntro: string;
  rulesPick: string;
  kindLabel: string; // "What do you want to post?"
  kinds: Record<PostKind, { name: string; hint: string }>;
  fieldTitle: string;
  fieldTitlePlaceholders: Record<PostKind, string>;
  fieldBody: string; // "Text (optional)"
  fieldBodyRequired: string; // "Text" (an article needs it)
  fieldBodyPlaceholders: Record<PostKind, string>;
  fieldVideo: string;
  fieldVideoPlaceholder: string;
  fieldVideoHelp: string; // which sites are accepted
  accessVideo: string; // contains {have}: shown when a video needs more reputation than the person has
  accessLink: string; // contains {have}
  errorBodyShort: string; // contains {min}
  errorLink: string; // the server refused a link
  errorVideoAccess: string; // the server refused a video
  errorVideo: string;
  agree: string; // contains {slug}
  submit: string;
  cancel: string;
  saving: string; // shown on the button while the post is being saved
  error: string; // shown when saving did not work
  login: string; // "Please log in to do this." (shown when nobody is logged in)
  loginLink: string; // "Log in"
};

export default function SubmitForm({
  communities,
  initialSlug,
  initialTitle = "",
  initialKind = "question",
  access = null,
  text,
}: {
  communities: SubmitCommunity[];
  initialSlug: string;
  initialTitle?: string; // e.g. typed in the box on the home page
  initialKind?: PostKind;
  access?: { reputation: number; video: boolean; link: boolean } | null; // null = nobody logged in (the server decides)
  text: SubmitText;
}) {
  const [slug, setSlug] = useState(initialSlug);
  const [kind, setKind] = useState<PostKind>(initialKind);
  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [failed, setFailed] = useState<false | "error" | "login" | "link" | "video">(false);
  const [pending, startTransition] = useTransition();
  const loggedOut = useLoggedOut(); // nobody logged in: the form is locked (the server refuses too)

  const community = communities.find((c) => c.slug === slug);
  // The same rules as the server (lib/post-input-rules.ts), so the button is only active for a post that will be accepted.
  const checked = checkPostInput({ kind, title, body, videoUrl });
  // Reputation (SITE_PLAN B5): a video and a web link have to be earned. The same test is made again on the server.
  const videoLocked = kind === "video" && access !== null && !access.video;
  const linkLocked = access !== null && !access.link && containsLink(`${title}\n${body}`);
  const canPost = Boolean(community) && checked.ok && agreed && !pending && !loggedOut && !videoLocked && !linkLocked;
  // A hint under the field, shown only after the person has typed something there (not before).
  const videoTyped = kind === "video" && videoUrl.trim().length > 0;
  const videoBad = videoTyped && parseVideoUrl(videoUrl) === null;
  const bodyShort = kind === "article" && body.trim().length > 0 && body.trim().length < postLimits.articleBodyMin;

  function pickCommunity(next: string) {
    setSlug(next);
    setAgreed(false); // rules differ per community, so the tick must be given again
    setFailed(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPost) return;
    setFailed(false);
    startTransition(async () => {
      // On success the action sends the browser to the new post and returns nothing.
      const result = await createPost({ slug, kind, title, body, videoUrl });
      if (result?.error) setFailed(result.login ? "login" : (result.reason ?? "error"));
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

        <label className="sf-label" htmlFor="sf-community">{text.communityLabel}</label>
        <select
          id="sf-community"
          className="pc-field"
          value={slug}
          disabled={loggedOut}
          onChange={(e) => pickCommunity(e.target.value)}
        >
          <option value="">{text.communityChoose}</option>
          {communities.map((c) => (
            <option key={c.slug} value={c.slug}>c/{c.slug} · {c.name}</option>
          ))}
        </select>
      </section>

      <section className="card sf-card" aria-live="polite">
        {community ? (
          <>
            <h2 className="sf-h2">{text.rulesTitle.replace("{slug}", community.slug)}</h2>
            <p className="sf-intro">{text.rulesIntro}</p>
            <ol className="sf-rules">
              {community.rules.map((r, i) => (
                <li key={r.title} className="pc-rule">
                  <span className="pc-rule-n">{i + 1}</span>
                  <span><b>{r.title}.</b> {r.text}</span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="sf-intro">{text.rulesPick}</p>
        )}
      </section>

      <section className="card sf-card">
        <fieldset className="sf-kinds" disabled={loggedOut}>
          <legend className="sf-label">{text.kindLabel}</legend>
          <div className="sf-kind-row">
            {postKinds.map((k) => (
              <label key={k} className={`sf-kind${kind === k ? " sf-kind-on" : ""}`}>
                <input
                  type="radio"
                  name="sf-kind"
                  value={k}
                  checked={kind === k}
                  onChange={() => { setKind(k); setFailed(false); }}
                />
                <span className="sf-kind-name">{text.kinds[k].name}</span>
                <span className="sf-kind-hint">{text.kinds[k].hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="sf-label" htmlFor="sf-title">{text.fieldTitle}</label>
        <input
          id="sf-title"
          className="pc-field"
          value={title}
          disabled={loggedOut}
          maxLength={postLimits.titleMax}
          placeholder={text.fieldTitlePlaceholders[kind]}
          onChange={(e) => setTitle(e.target.value)}
        />

        {kind === "video" && (
          <>
            <label className="sf-label" htmlFor="sf-video">{text.fieldVideo}</label>
            <input
              id="sf-video"
              className="pc-field"
              type="url"
              inputMode="url"
              value={videoUrl}
              disabled={loggedOut}
              maxLength={postLimits.videoUrlMax}
              placeholder={text.fieldVideoPlaceholder}
              aria-invalid={videoBad}
              aria-describedby="sf-video-help"
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            {videoLocked && access && (
              <p className="sf-intro sf-bad">{text.accessVideo.replace("{have}", String(access.reputation))}</p>
            )}
            <p id="sf-video-help" className={`sf-intro${videoBad ? " sf-bad" : ""}`}>
              {videoBad ? text.errorVideo : text.fieldVideoHelp}
            </p>
          </>
        )}

        <label className="sf-label" htmlFor="sf-body">
          {kind === "article" ? text.fieldBodyRequired : text.fieldBody}
        </label>
        <textarea
          id="sf-body"
          className="pc-field"
          rows={kind === "article" ? 14 : 7}
          value={body}
          disabled={loggedOut}
          maxLength={postLimits.bodyMax}
          placeholder={text.fieldBodyPlaceholders[kind]}
          onChange={(e) => setBody(e.target.value)}
        />
        {linkLocked && access && (
          <p className="sf-intro sf-bad">{text.accessLink.replace("{have}", String(access.reputation))}</p>
        )}
        {bodyShort && (
          <p className="sf-intro sf-bad">{text.errorBodyShort.replace("{min}", String(postLimits.articleBodyMin))}</p>
        )}

        {community && (
          <label className="sf-agree">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>{text.agree.replace("{slug}", community.slug)}</span>
          </label>
        )}

        {failed && (
          <div className="notice notice-danger" role="alert">
            {failed === "login" ? <LoginNotice text={{ message: text.login, link: text.loginLink }} /> : failed === "link" ? text.errorLink : failed === "video" ? text.errorVideoAccess : text.error}
          </div>
        )}

        <div className="sf-actions">
          <Link href={community ? `/c/${community.slug}` : "/"} className="btn btn-secondary btn-lg">
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
