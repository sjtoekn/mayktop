// Notification settings: the plain rules (SOCIAL_TODO B8, patch-social-notif-settings). No database, no imports, so a test can
// run them. ACCOUNT_RULES.md 3.20.
//  - Every notification type is ON by default. Only the types a person switched OFF are stored (so a new type needs no migration).
//  - A switched-off type is not shown on /notifications and is not counted by the bell. The rows are KEPT (turning the type on
//    again shows them again); they are not sent anywhere. No email is sent for any notification today.
//  - The values are the `type` of a Notification row. A test checks that they equal the constants of the code that creates them.

export const NOTIFICATION_SETTING_TYPES = [
  "FOLLOW",
  "SOCIAL_POST_LIKE",
  "SOCIAL_POST_REPOST",
  "SOCIAL_POST_REPLY",
  "SOCIAL_MENTION",
] as const;

export type NotificationSettingType = (typeof NOTIFICATION_SETTING_TYPES)[number];

const KNOWN = new Set<string>(NOTIFICATION_SETTING_TYPES);

/** The list of types that are ON, from the browser: an array of known types (repeats allowed), else null (refused whole). */
export function cleanEnabledTypes(raw: unknown): NotificationSettingType[] | null {
  if (!Array.isArray(raw) || raw.length > NOTIFICATION_SETTING_TYPES.length * 4) return null;
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string" || !KNOWN.has(item)) return null;
    seen.add(item);
  }
  return NOTIFICATION_SETTING_TYPES.filter((type) => seen.has(type));
}

/** The types to STORE as off: every known type that is not in the ON list. */
export function offTypesFor(enabled: readonly string[]): NotificationSettingType[] {
  const on = new Set(enabled);
  return NOTIFICATION_SETTING_TYPES.filter((type) => !on.has(type));
}

/** The types that are ON, from the stored OFF list (unknown stored values are ignored). */
export function enabledTypesFrom(off: readonly string[]): NotificationSettingType[] {
  const gone = new Set(off);
  return NOTIFICATION_SETTING_TYPES.filter((type) => !gone.has(type));
}
