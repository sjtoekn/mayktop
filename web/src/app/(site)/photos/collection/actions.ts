"use server";

// Photo collections (private). The rules are in src/lib/photo-collection.ts. Rate limit: the Social bookmark numbers, in their
// own key, with the stricter limits of a new account. Nothing is cached, nobody is notified.
import { socialLimits } from "@/config/site";
import { limitsFor } from "@/lib/account-limits";
import {
  applyCollectionToggle,
  createCollectionWithPhoto,
  listCollectionsForPhoto,
  type PhotoCollectionFail,
  type PhotoCollectionRow,
} from "@/lib/photo-collection";
import { prisma } from "@/lib/prisma";
import { takeActionDb } from "@/lib/rate-limit-db";
import { getSessionUser } from "@/lib/session";

const rules = socialLimits.bookmarks.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));

export type PhotoCollectionFailure = { error: true; reason: "login" | "tooMany" | "full" | "exists" | "badName" | "error" };

function failure(reason: PhotoCollectionFail): PhotoCollectionFailure {
  if (reason === "full" || reason === "exists") return { error: true, reason };
  if (reason === "badname") return { error: true, reason: "badName" };
  return { error: true, reason: "error" };
}

export async function getPhotoCollections(photoId: number): Promise<{ collections: PhotoCollectionRow[] } | PhotoCollectionFailure> {
  const viewer = await getSessionUser();
  if (!viewer) return { error: true, reason: "login" };
  try {
    const collections = await prisma.$transaction((tx) => listCollectionsForPhoto(tx, viewer.id, photoId));
    return { collections };
  } catch (error) {
    console.error("getPhotoCollections failed:", error);
    return { error: true, reason: "error" };
  }
}

export async function togglePhotoInCollection(collectionId: number, photoId: number, add: boolean): Promise<{ has: boolean } | PhotoCollectionFailure> {
  const viewer = await getSessionUser();
  if (!viewer) return { error: true, reason: "login" };
  if (!(await takeActionDb(`photo-collection:${viewer.id}`, limitsFor(rules, viewer))).ok) return { error: true, reason: "tooMany" };
  try {
    const result = await prisma.$transaction((tx) => applyCollectionToggle(tx, { userId: viewer.id, collectionId, photoId, add }));
    return result.ok ? { has: result.has } : failure(result.reason);
  } catch (error) {
    console.error("togglePhotoInCollection failed:", error);
    return { error: true, reason: "error" };
  }
}

export async function createPhotoCollection(photoId: number, name: string): Promise<{ collection: PhotoCollectionRow } | PhotoCollectionFailure> {
  const viewer = await getSessionUser();
  if (!viewer) return { error: true, reason: "login" };
  if (!(await takeActionDb(`photo-collection:${viewer.id}`, limitsFor(rules, viewer))).ok) return { error: true, reason: "tooMany" };
  try {
    const result = await prisma.$transaction((tx) => createCollectionWithPhoto(tx, { userId: viewer.id, name, photoId }));
    return result.ok ? { collection: result.collection } : failure(result.reason);
  } catch (error) {
    console.error("createPhotoCollection failed:", error);
    return { error: true, reason: "error" };
  }
}
