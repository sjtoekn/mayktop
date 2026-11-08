// Admin Part 6 (Appeals): the list of open appeals for a screen. No rule lives here. The list and the details come
// from appeals.ts (listOpenAppeals, showAppeal); this file only adds a short preview and says whether THIS admin
// may decide each appeal (checkDecideAppeal, the same check decideAppeal makes again before it changes anything).
import { appealDeciders, listOpenAppeals, showAppeal, type AdSummary, type AppealKind } from "@/lib/appeals";
import { checkDecideAppeal } from "@/lib/appeals-rules";
import { excerpt } from "@/lib/review-rules";

export const APPEAL_PREVIEW_LENGTH = 240;

export type AppealItem = {
  id: number;
  kind: AppealKind;
  appellant: string; // username
  createdAt: Date;
  overdue: boolean;
  message: string; // what the person wrote
  firstAction: string; // AuditAction of the decision that is appealed
  firstActor: string; // username of the person who made it
  rule: string;
  reason: string;
  community: string;
  contentKind: "post" | "comment" | null;
  social: "post" | "reply" | null; // a Social post / reply appeal (SOCIAL_TODO 29)
  postId: number | null;
  ad: AdSummary | null; // ad appeals (Session 4c): the ad that was rejected
  preview: string; // short preview of the post title / comment text ("" for an account appeal)
  block: "self" | "same" | null; // why THIS admin cannot decide it (null = can decide)
};

export async function loadAppealQueue(meId: string): Promise<AppealItem[]> {
  const open = await listOpenAppeals(); // oldest first, with the OVERDUE flag
  const items: AppealItem[] = [];
  for (const o of open) {
    const [details, who] = await Promise.all([showAppeal(o.id), appealDeciders(o.id)]);
    if (!details || !who) continue; // vanished between the reads: skip it
    // An admin is always allowed; "self" (own appeal) and "same" (took part in the first decision) are what is left.
    const refused = checkDecideAppeal({
      kind: details.kind,
      actor: { id: meId, isAdmin: true, isCommunityModerator: false },
      appellantId: who.appellantId,
      deciderIds: who.deciderIds,
      status: "OPEN",
    });
    items.push({
      id: o.id,
      kind: details.kind,
      appellant: details.appellant,
      createdAt: details.createdAt,
      overdue: o.overdue,
      message: details.message,
      firstAction: details.firstAction,
      firstActor: details.firstActor,
      rule: details.rule,
      reason: details.reason,
      community: details.community,
      contentKind: details.contentKind,
      social: details.social,
      postId: details.social ? null : (details.content?.postId ?? null), // a Social item has no community-post page to open
      ad: details.ad ?? null,
      preview: details.content ? excerpt(details.content.text, APPEAL_PREVIEW_LENGTH) : "",
      block: refused === "self" || refused === "same" ? refused : null,
    });
  }
  return items;
}
