// The plain rules of "a member asks for a new community". No database here, so they are easy to read and to test.
// src/lib/community-request.ts does the work (saving, approving, rejecting).
import { communityCategories, type CommunityCategory } from "@/config/site";

export type CommunityRule = { title: string; text: string };
export type CommunityRequestInput = { name: string; slug: string; description: string; category: CommunityCategory; rules: CommunityRule[] };

export const crLimits = {
  nameMin: 3, nameMax: 40,
  slugMin: 3, slugMax: 24,
  descMin: 10, descMax: 300,
  rulesMin: 3, rulesMax: 5,
  ruleTitleMin: 2, ruleTitleMax: 40,
  ruleTextMin: 5, ruleTextMax: 200,
  noteMin: 5, noteMax: 300,
  maxPending: 1, // one waiting request per person
  perDay: 3, // at most 3 new requests a day per person
} as const;

// Names that are already pages of the site: /c/<slug> must never look like one of them.
const RESERVED = new Set([
  "admin", "api", "new", "submit", "popular", "explore", "top", "saved", "notifications", "profile", "u", "c", "post",
  "social", "shorts", "photos", "news", "places", "login", "signup", "settings", "advertise", "modlog", "fairness",
  "appeal", "search", "communities", "all", "home",
]);

// The `type` of the Notification rows made when an admin decides. They are about the person's OWN request, so they are
// always shown (they have no on/off switch in the notification settings, and a block or mute does not hide them).
export const COMMUNITY_APPROVED_NOTIFICATION = "COMMUNITY_APPROVED";
export const COMMUNITY_REJECTED_NOTIFICATION = "COMMUNITY_REJECTED";
export const COMMUNITY_NOTIFICATIONS = [COMMUNITY_APPROVED_NOTIFICATION, COMMUNITY_REJECTED_NOTIFICATION] as const;

export type CrError =
  | "login" | "name" | "slug" | "reserved" | "taken" | "description" | "category" | "rules"
  | "pending" | "limit" | "notfound" | "decided" | "note" | "other";

/** "Easy Healthy Food!" -> "easy-healthy-food" (lower case a-z, digits and single hyphens). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, crLimits.slugMax)
    .replace(/-+$/g, "");
}

/** While typing in the address field: lower case, anything that is not a-z / 0-9 becomes a single hyphen (a pasted link turns into a plain address). */
export function cleanSlugInput(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, crLimits.slugMax);
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= crLimits.slugMin && slug.length <= crLimits.slugMax && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

/** Checks (and trims) what the browser sent. The browser is never trusted. */
export function checkRequestInput(raw: unknown): { ok: true; value: CommunityRequestInput } | { error: CrError } {
  const r = raw as Partial<CommunityRequestInput> | null;
  if (!r || typeof r.name !== "string" || typeof r.slug !== "string" || typeof r.description !== "string" || !Array.isArray(r.rules)) {
    return { error: "other" };
  }
  const name = r.name.trim().replace(/\s+/g, " ");
  const slug = r.slug.trim().toLowerCase();
  const description = r.description.trim();
  if (name.length < crLimits.nameMin || name.length > crLimits.nameMax) return { error: "name" };
  if (!isValidSlug(slug)) return { error: "slug" };
  if (RESERVED.has(slug)) return { error: "reserved" };
  if (description.length < crLimits.descMin || description.length > crLimits.descMax) return { error: "description" };
  if (typeof r.category !== "string" || !(communityCategories as readonly string[]).includes(r.category)) return { error: "category" };
  const category = r.category as CommunityCategory;
  if (r.rules.length < crLimits.rulesMin || r.rules.length > crLimits.rulesMax) return { error: "rules" };
  const rules: CommunityRule[] = [];
  for (const item of r.rules as unknown[]) {
    const rule = item as Partial<CommunityRule> | null;
    if (!rule || typeof rule.title !== "string" || typeof rule.text !== "string") return { error: "rules" };
    const title = rule.title.trim();
    const text = rule.text.trim();
    if (title.length < crLimits.ruleTitleMin || title.length > crLimits.ruleTitleMax) return { error: "rules" };
    if (text.length < crLimits.ruleTextMin || text.length > crLimits.ruleTextMax) return { error: "rules" };
    rules.push({ title, text });
  }
  return { ok: true, value: { name, slug, description, category, rules } };
}
