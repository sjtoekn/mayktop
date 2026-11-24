import type { Metadata } from "next";
import { Suspense } from "react";
import SubmitForm, { type SubmitCommunity } from "@/components/SubmitForm";
import { t } from "@/i18n";
import { getCommunities } from "@/lib/queries";
import { isPostKind } from "@/lib/post-input-rules";
import type { PostKind } from "@/config/site";
import { reputationConfig } from "@/config/site";
import { getSessionUser } from "@/lib/session";
import { getAccess } from "@/lib/reputation";
import { hasPrivilege } from "@/lib/reputation-rules";

export const metadata: Metadata = { title: t("submit.title") };

function text() {
  return {
    title: t("submit.title"),
    communityLabel: t("submit.community.label"),
    communityChoose: t("submit.community.choose"),
    rulesTitle: t("submit.rules.title", { slug: "{slug}" }),
    rulesIntro: t("submit.rules.intro"),
    rulesPick: t("submit.rules.pick"),
    kindLabel: t("submit.kind.label"),
    kinds: {
      question: { name: t("post.kind.question"), hint: t("submit.kind.question.hint") },
      article: { name: t("post.kind.article"), hint: t("submit.kind.article.hint") },
      video: { name: t("post.kind.video"), hint: t("submit.kind.video.hint") },
    },
    fieldTitle: t("submit.field.title"),
    fieldTitlePlaceholders: {
      question: t("submit.field.title.placeholder"),
      article: t("submit.field.title.placeholder.article"),
      video: t("submit.field.title.placeholder.video"),
    },
    fieldBody: t("submit.field.body"),
    fieldBodyRequired: t("submit.field.body.required"),
    fieldBodyPlaceholders: {
      question: t("submit.field.body.placeholder"),
      article: t("submit.field.body.placeholder.article"),
      video: t("submit.field.body.placeholder.video"),
    },
    fieldVideo: t("submit.field.video"),
    fieldVideoPlaceholder: t("submit.field.video.placeholder"),
    fieldVideoHelp: t("submit.field.video.help"),
    accessVideo: t("submit.access.video", { need: reputationConfig.privileges.video, have: "{have}" }),
    accessLink: t("submit.access.link", { need: reputationConfig.privileges.link, have: "{have}" }),
    errorBodyShort: t("submit.error.bodyshort"),
    errorLink: t("submit.error.link", { need: reputationConfig.privileges.link }),
    errorVideoAccess: t("submit.error.videoaccess", { need: reputationConfig.privileges.video }),
    errorVideo: t("submit.error.video"),
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
  searchParams: Promise<{ c?: string; title?: string; kind?: string }>;
  choices: SubmitCommunity[];
}) {
  const { c, title, kind } = await searchParams;
  const initialSlug = choices.some((x) => x.slug === c) ? (c as string) : "";
  // The title typed in the home page box (same 120 limit as the form field).
  const initialTitle = typeof title === "string" ? title.slice(0, 120) : "";
  // ?kind=article opens the form on that kind (links like "Write an article" can use it); anything else is a question.
  const initialKind: PostKind = isPostKind(kind) ? kind : "question";
  // What this person's reputation allows (SITE_PLAN B5), so the form can say so BEFORE they write. The server checks again.
  const viewer = await getSessionUser();
  const access = viewer ? await getAccess(viewer.id) : null;
  const accessInfo = access
    ? { reputation: access.reputation, video: hasPrivilege(access.reputation, "video", access.staff), link: hasPrivilege(access.reputation, "link", access.staff) }
    : null;
  return (
    <SubmitForm communities={choices} initialSlug={initialSlug} initialTitle={initialTitle} initialKind={initialKind} access={accessInfo} text={text()} />
  );
}

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; title?: string; kind?: string }>;
}) {
  const communities = await getCommunities();
  const choices = communities.map((x) => ({ slug: x.slug, name: x.name, rules: x.rules }));
  return (
    <Suspense fallback={<SubmitForm communities={choices} initialSlug="" text={text()} />}>
      <FormWithChoice searchParams={searchParams} choices={choices} />
    </Suspense>
  );
}
