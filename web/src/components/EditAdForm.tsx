"use client";
// Fix a rejected ad and send it again (ADS_PLAN Session 4b). Text, link and contact email only; the format, the place and the
// picture / video stay as they are. All visible text comes in as props. The server checks everything again (ad-own.ts).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { editMyAd } from "@/app/(site)/advertise/my/actions";

export type EditAdText = {
  fieldTitle: string;
  fieldBody: string;
  fieldUrl: string;
  fieldUrlHint: string;
  fieldEmail: string;
  fieldEmailHint: string;
  agree: string;
  rulesLink: string;
  send: string;
  saving: string;
  cancel: string;
  errors: Record<string, string>; // by error code, plus "other"; "words" may contain {phrase}
};

type Props = {
  adId: number;
  initial: { title: string; body: string; url: string; email: string };
  limits: { titleMax: number; bodyMax: number };
  text: EditAdText;
};

export default function EditAdForm({ adId, initial, limits, text }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [url, setUrl] = useState(initial.url);
  const [email, setEmail] = useState(initial.email);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    startTransition(async () => {
      const result = await editMyAd({ adId, title, body, url, email, agree });
      if ("error" in result) {
        const template = text.errors[result.error] ?? text.errors.other;
        const phrase = "phrase" in result && result.phrase ? result.phrase : "";
        setError(template.replace("{phrase}", phrase));
        return;
      }
      setError(null);
      router.push("/advertise/my");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="adv-card card" noValidate>
      <label className="adv-label" htmlFor="ea-title">{text.fieldTitle}</label>
      <input id="ea-title" className="pc-field" value={title} maxLength={limits.titleMax} onChange={(e) => setTitle(e.target.value)} />
      <span className="adv-count" aria-hidden="true">{title.length}/{limits.titleMax}</span>

      <label className="adv-label" htmlFor="ea-body">{text.fieldBody}</label>
      <textarea id="ea-body" className="pc-field" rows={3} value={body} maxLength={limits.bodyMax} onChange={(e) => setBody(e.target.value)} />
      <span className="adv-count" aria-hidden="true">{body.length}/{limits.bodyMax}</span>

      <label className="adv-label" htmlFor="ea-url">{text.fieldUrl}</label>
      <input id="ea-url" className="pc-field" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} />
      <p className="adv-hint">{text.fieldUrlHint}</p>

      <label className="adv-label" htmlFor="ea-email">{text.fieldEmail}</label>
      <input id="ea-email" className="pc-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <p className="adv-hint">{text.fieldEmailHint}</p>

      <label className="sf-agree">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>
          {text.agree} <Link href="/advertise#rules" className="underline">{text.rulesLink}</Link>
        </span>
      </label>

      {error && <div className="notice notice-danger" role="alert">{error}</div>}

      <div className="adv-actions">
        <Link href="/advertise/my" className="btn btn-ghost btn-lg">{text.cancel}</Link>
        <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>{pending ? text.saving : text.send}</button>
      </div>
    </form>
  );
}
