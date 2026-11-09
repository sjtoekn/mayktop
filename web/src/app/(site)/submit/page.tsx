import type { Metadata } from "next";
import { Suspense } from "react";
import SubmitForm, { type SubmitCommunity } from "@/components/SubmitForm";
import { t } from "@/i18n";
import { getCommunities } from "@/lib/queries";

export const metadata: Metadata = { title: t("submit.title") };

function text() {
  return {
    title: t("submit.title"),
    communityLabel: t("submit.community.label"),
    communityChoose: t("submit.community.choose"),
    rulesTitle: t("submit.rules.title", { slug: "{slug}" }),
    rulesIntro: t("submit.rules.intro"),
    rulesPick: t("submit.rules.pick"),
    fieldTitle: t("submit.field.title"),
    fieldTitlePlaceholder: t("submit.field.title.placeholder"),
    fieldBody: t("submit.field.body"),
    fieldBodyPlaceholder: t("submit.field.body.placeholder"),
    agree: t("submit.agree", { slug: "{slug}" }),
    submit: t("submit.submit"),
    cancel: t("submit.cancel"),
    saving: t("submit.saving"),
    error: t("submit.error"),
    login: t("auth.required"),
    loginLink: t("topbar.login"),
  };
}

// searchParams is read per request, so it must sit inside <Suspense>
// (Cache Components rule). The fallback is the same form with no community chosen.
async function FormWithChoice({
  searchParams,
  choices,
}: {
  searchParams: Promise<{ c?: string; title?: string }>;
  choices: SubmitCommunity[];
}) {
  const { c, title } = await searchParams;
  const initialSlug = choices.some((x) => x.slug === c) ? (c as string) : "";
  // The title typed in the home page box (same 120 limit as the form field).
  const initialTitle = typeof title === "string" ? title.slice(0, 120) : "";
  return (
    <SubmitForm communities={choices} initialSlug={initialSlug} initialTitle={initialTitle} text={text()} />
  );
}

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; title?: string }>;
}) {
  const communities = await getCommunities();
  const choices = communities.map((x) => ({ slug: x.slug, name: x.name, rules: x.rules }));
  return (
    <Suspense fallback={<SubmitForm communities={choices} initialSlug="" text={text()} />}>
      <FormWithChoice searchParams={searchParams} choices={choices} />
    </Suspense>
  );
}
