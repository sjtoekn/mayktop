"use server";

import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { socialLimits } from "@/config/site";
import { takeActionDb } from "@/lib/rate-limit-db";
import { applyNotificationSettings } from "@/lib/notification-settings";

// Save the notification settings (SOCIAL_TODO B8): the list of types that are ON. The person comes from the login cookie only.
const rules = socialLimits.notificationSettings.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));

export type NotificationSettingsActionResult = { error: true; login?: true; tooMany?: true } | { saved: true };

export async function saveNotificationSettings(enabled: string[]): Promise<NotificationSettingsActionResult> {
  const viewer = await getSessionUser();
  if (!viewer) return { error: true, login: true };
  if (!(await takeActionDb(`notif-settings:${viewer.id}`, rules)).ok) return { error: true, tooMany: true };

  try {
    const result = await prisma.$transaction((tx) => applyNotificationSettings(tx, { userId: viewer.id, enabled }));
    if (!result.ok) return { error: true };
    updateTag("notifications"); // the bell count
    revalidatePath("/notifications");
    return { saved: true };
  } catch (error) {
    console.error("saveNotificationSettings failed:", error);
    return { error: true };
  }
}
