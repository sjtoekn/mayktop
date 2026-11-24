"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { collectNewsNow, safeHttpUrl } from "@/lib/news-collector";

export type NewsAdminResult = { ok: true } | { error: string };

export async function addNewsSource(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const feedUrlRaw = String(formData.get("feedUrl") ?? "").trim();
  const siteUrlRaw = String(formData.get("siteUrl") ?? "").trim();
  const feedUrl = safeHttpUrl(feedUrlRaw);
  const siteUrl = siteUrlRaw ? safeHttpUrl(siteUrlRaw) : null;
  if (!name || !feedUrl || (siteUrlRaw && !siteUrl)) return;
  try {
    await prisma.newsSource.create({ data: { name, feedUrl, siteUrl } });
  } catch (error) {
    console.error("addNewsSource failed:", error);
    return;
  }
  revalidatePath("/admin/news");
  revalidatePath("/news");
}

export async function setNewsSourceEnabled(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const enabled = formData.get("enabled") === "true";
  if (!Number.isSafeInteger(id) || id <= 0) return;
  await prisma.newsSource.updateMany({ where: { id }, data: { enabled } });
  revalidatePath("/admin/news");
}

export async function collectNewsAction(): Promise<void> {
  await requireAdmin();
  const result = await collectNewsNow();
  console.info("Manual Falvenco News collection:", result);
  revalidatePath("/admin/news");
  revalidatePath("/news");
}
