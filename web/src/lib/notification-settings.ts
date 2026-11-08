// Notification settings: the writes (SOCIAL_TODO B8, patch-social-notif-settings). The server action calls
// `applyNotificationSettings` inside a transaction; a test calls it too. Rules: notification-settings-rules.ts, ACCOUNT_RULES.md 3.20.
import type { Prisma } from "../../generated/prisma/client";
import { cleanEnabledTypes, offTypesFor, type NotificationSettingType } from "@/lib/notification-settings-rules";

type Db = Prisma.TransactionClient;

export type NotificationSettingsResult = { ok: true; enabled: NotificationSettingType[] } | { ok: false; reason: "error" };

/** Saves the whole list of types that are ON (everything else becomes OFF). Same list twice changes nothing. */
export async function applyNotificationSettings(db: Db, input: { userId: string; enabled: unknown }): Promise<NotificationSettingsResult> {
  const enabled = cleanEnabledTypes(input.enabled);
  if (enabled === null || !input.userId) return { ok: false, reason: "error" };
  const off = offTypesFor(enabled);
  await db.notificationOptOut.deleteMany({ where: { userId: input.userId } });
  for (const type of off) await db.notificationOptOut.create({ data: { userId: input.userId, type } });
  return { ok: true, enabled };
}

/** Final erasure (ACCOUNT_RULES.md 3.7): the person's settings. Safe to run twice. */
export async function eraseNotificationSettings(db: Db, userId: string): Promise<number> {
  const result = await db.notificationOptOut.deleteMany({ where: { userId } });
  return result.count;
}
