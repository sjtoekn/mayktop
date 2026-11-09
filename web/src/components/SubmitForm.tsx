"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import LoginNotice from "@/components/LoginNotice";
import { useLoggedOut } from "@/lib/use-logged-out";
import { createPost } from "@/app/(site)/submit/actions";

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
  fieldTitle: string;
  fieldTitlePlaceholder: string;
  fieldBody: string;
  fieldBodyPlaceholder: string;
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
  text,
}: {
  communities: SubmitCommunity[];
  initialSlug: string;
  initialTitle?: string; // e.g. typed in the box on the home page
  text: SubmitText;
}) {
  const [slug, setSlug] = useState(initialSlug);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [failed, setFailed] = useState<false | "error" | "login">(false);
  const [pending, startTransition] = useTransition();
  const loggedOut = useLoggedOut(); // nobody logged in: the form is locked (the server refuses too)

  const community = communities.find((c) => c.slug === slug);
  const canPost = Boolean(community) && title.trim().length > 0 && agreed && !pending && !loggedOut;

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
      const result = await createPost({ slug, title, body });
      if (result?.error) setFailed(result.login ? "login" : "error");
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
        <label className="sf-label" htmlFor="sf-title">{text.fieldTitle}</label>
        <input
          id="sf-title"
          className="pc-field"
          value={title}
          disabled={loggedOut}
          maxLength={120}
          placeholder={text.fieldTitlePlaceholder}
          onChange={(e) => setTitle(e.target.value)}
        />

        <label className="sf-label" htmlFor="sf-body">{text.fieldBody}</label>
        <textarea
          id="sf-body"
          className="pc-field"
          rows={7}
          value={body}
          disabled={loggedOut}
          placeholder={text.fieldBodyPlaceholder}
          onChange={(e) => setBody(e.target.value)}
        />

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
            {failed === "login" ? <LoginNotice text={{ message: text.login, link: text.loginLink }} /> : text.error}
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
