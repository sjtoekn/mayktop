"use client";
// The "Create a community" form. The address (slug) follows the name until the person edits it by hand.
// Everything is checked again on the server (community-request-rules.ts).
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCommunityRequest } from "@/app/(site)/communities/new/actions";
import { communityCategories } from "@/config/site";
import { checkRequestInput, cleanSlugInput, crLimits, slugify } from "@/lib/community-request-rules";
import type { crText as CrText } from "@/lib/community-request-text";

type Rule = { title: string; text: string };

export default function CommunityRequestForm({ text }: { text: typeof CrText }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [rules, setRules] = useState<Rule[]>(() => Array.from({ length: crLimits.rulesMin }, () => ({ title: "", text: "" })));
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  function showError(message: string) {
    setError(message);
    // The message sits near the button, which can be far below the field: bring it into view.
    setTimeout(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }

  function setRule(i: number, patch: Partial<Rule>) {
    setRules((list) => list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function submit() {
    setError(null);
    const input = { name, slug, description, category, rules };
    const local = checkRequestInput(input); // same rules as the server: tells the person at once, nothing is sent
    if ("error" in local) {
      showError(text.errors[local.error] ?? text.errors.other);
      return;
    }
    start(async () => {
      const result = await createCommunityRequest(input);
      if ("error" in result) {
        showError(text.errors[result.error] ?? text.errors.other);
        return;
      }
      setSent(true);
      router.refresh();
    });
  }

  if (sent) {
    return (
      <div className="notice notice-success" role="status">
        <p><b>{text.sentTitle}</b></p>
        <p>{text.sentText}</p>
      </div>
    );
  }

  return (
    <div className="sf-wrap">
      <section className="card sf-card">
        <label className="sf-label" htmlFor="cr-name">{text.fieldName}</label>
        <input
          id="cr-name" className="pc-field" value={name} maxLength={crLimits.nameMax} placeholder={text.fieldNamePlaceholder}
          onChange={(e) => { setName(e.target.value); if (!slugEdited) setSlug(slugify(e.target.value)); }}
        />

        <label className="sf-label" htmlFor="cr-slug">{text.fieldSlug}</label>
        <input
          id="cr-slug" className="pc-field" value={slug} maxLength={crLimits.slugMax} dir="ltr"
          onChange={(e) => { setSlugEdited(true); setSlug(cleanSlugInput(e.target.value)); }}
        />
        <p className="pc-meta">{text.fieldSlugHint} <b>/c/{slug || "..."}</b></p>

        <label className="sf-label" htmlFor="cr-desc">{text.fieldDescription}</label>
        <textarea
          id="cr-desc" className="pc-field" rows={3} value={description} maxLength={crLimits.descMax}
          placeholder={text.fieldDescriptionPlaceholder} onChange={(e) => setDescription(e.target.value)}
        />

        <label className="sf-label" htmlFor="cr-category">{text.fieldCategory}</label>
        <select id="cr-category" className="pc-field" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{text.fieldCategoryPlaceholder}</option>
          {communityCategories.map((key) => (
            <option key={key} value={key}>{text.categories[key] ?? key}</option>
          ))}
        </select>
      </section>

      <section className="card sf-card">
        <h2 className="sf-h2">{text.rulesTitle}</h2>
        <p className="pc-meta">{text.rulesIntro}</p>
        {rules.map((rule, i) => (
          <div key={i} style={{ display: "grid", gap: 8, paddingInlineStart: 14, borderInlineStart: "3px solid var(--line-strong)" }}>
            <p className="sf-label" style={{ margin: 0 }}>{`${text.rule} ${i + 1}`}</p>
            <input
              className="pc-field" aria-label={`${text.ruleTitle} ${i + 1}`} placeholder={text.ruleTitle}
              value={rule.title} maxLength={crLimits.ruleTitleMax} onChange={(e) => setRule(i, { title: e.target.value })}
            />
            <input
              className="pc-field" aria-label={`${text.ruleText} ${i + 1}`} placeholder={text.ruleText}
              value={rule.text} maxLength={crLimits.ruleTextMax} onChange={(e) => setRule(i, { text: e.target.value })}
            />
            {rules.length > crLimits.rulesMin && (
              <button type="button" className="pc-pill pc-pill-sm" onClick={() => setRules((l) => l.filter((_, idx) => idx !== i))}>
                {text.removeRule}
              </button>
            )}
          </div>
        ))}
        {rules.length < crLimits.rulesMax && (
          <button type="button" className="pc-pill" onClick={() => setRules((l) => [...l, { title: "", text: "" }])}>
            + {text.addRule}
          </button>
        )}
      </section>

      {error && <div ref={errorRef} className="notice notice-danger" role="alert">{error}</div>}
      <div className="sf-actions">
        <button type="button" className="pc-btn" disabled={pending} onClick={submit}>
          {pending ? text.sending : text.submit}
        </button>
      </div>
    </div>
  );
}
