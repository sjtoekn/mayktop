"use server";

// "Mark all as read" (SOCIAL_TODO 21). The person comes from the login cookie only; only their own rows change.
import { revalidatePath, updateTag } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { markAllNotificationsReadFor } from "@/lib/social-notifications";

export async function markAllNotificationsRead(): Promise<void> {
  const viewer = await getSessionUser();
  if (!viewer) return;
  try {
    await markAllNotificationsReadFor(viewer.id);
    updateTag("notifications");
    revalidatePath("/notifications");
  } catch (error) {
    console.error("markAllNotificationsRead failed:", error);
  }
}
