// The words of the "Create a community" screens. Kept in ONE place (English) so it is easy to move into the
// i18n files later (en, de, es, fr, pt): every key below becomes one t() key.
import { crLimits } from "@/lib/community-request-rules";

export const crText = {
  title: "Create a community",
  intro: "Ask for a new community. An admin reads every request before it goes live. You become its moderator when it is approved.",
  loginMessage: "Please log in to create a community.",
  loginLink: "Log in",
  fieldName: "Community name",
  fieldNamePlaceholder: "e.g. Easy Healthy Food",
  fieldSlug: "Web address",
  fieldSlugHint: "Letters, numbers and hyphens only. This becomes /c/your-name and cannot be changed later.",
  fieldDescription: "What is this community about?",
  fieldDescriptionPlaceholder: "One or two sentences that tell people what belongs here.",
  rulesTitle: `Community rules (${crLimits.rulesMin} to ${crLimits.rulesMax})`,
  rulesIntro: "Short and clear. Every removal on the site points to one of these rules.",
  rule: "Rule",
  ruleTitle: "Rule title",
  ruleText: "What it means",
  addRule: "Add a rule",
  removeRule: "Remove",
  submit: "Send for approval",
  sending: "Sending...",
  sentTitle: "Request sent",
  sentText: "An admin will review it. You can follow the status below.",
  waitingTitle: "You already have a request waiting",
  waitingText: "You can send another one after an admin decides on it.",
  yourRequests: "Your requests",
  status: { PENDING: "Waiting for review", APPROVED: "Approved", REJECTED: "Rejected" } as Record<string, string>,
  open: "Open community",
  reasonLabel: "Reason:",
  errors: {
    login: "Please log in first.",
    name: `The name must be ${crLimits.nameMin}-${crLimits.nameMax} characters.`,
    slug: `The web address must be ${crLimits.slugMin}-${crLimits.slugMax} characters: lower case letters, numbers and single hyphens.`,
    reserved: "That web address is used by the site itself. Please choose another.",
    taken: "A community (or a waiting request) already uses that web address.",
    description: `The description must be ${crLimits.descMin}-${crLimits.descMax} characters.`,
    rules: `Give ${crLimits.rulesMin} to ${crLimits.rulesMax} rules. Each needs a title (${crLimits.ruleTitleMin}-${crLimits.ruleTitleMax} characters) and a text (${crLimits.ruleTextMin}-${crLimits.ruleTextMax} characters).`,
    pending: "You already have a request waiting for review.",
    limit: `You can send at most ${crLimits.perDay} requests a day. Please try again tomorrow.`,
    notfound: "That request was not found.",
    decided: "That request was already decided.",
    note: `Write a reason (${crLimits.noteMin}-${crLimits.noteMax} characters).`,
    other: "Something went wrong. Nothing was saved. Please try again.",
  } as Record<string, string>,
  admin: {
    title: "Community requests",
    intro: "Members ask for new communities here. Approving creates the community, its rules and makes the requester its moderator.",
    empty: "No requests are waiting.",
    pendingTitle: "Waiting for review",
    decidedTitle: "Recently decided",
    by: "Requested by",
    approve: "Approve",
    reject: "Reject",
    noteLabel: "Reason for the member (required to reject)",
    working: "Working...",
    back: "Back to communities",
    link: "Community requests",
  },
};

/** The one-line text of the notification for a decided request (English; move into the i18n files later). */
export function crNotificationText(approved: boolean, name: string, slug: string, note: string | null): string {
  return approved
    ? `Your community "${name}" (c/${slug}) was approved. You are its moderator.`
    : `Your request for the community "${name}" was not approved.${note ? ` Reason: ${note}` : ""}`;
}
