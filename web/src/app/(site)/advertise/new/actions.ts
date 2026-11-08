"use server";

// Saves an ad that the logged-in person sent from the "Create an ad" form (ADS_PLAN Sessions 3 and 3b).
// All checking and saving is in src/lib/ad-submit.ts (which uses ad-input.ts and ad-media.ts); this file only adds
// "who is logged in?" and reads the form. The form is sent as FormData because IMAGE / VIDEO ads carry files:
//   text fields: format, slot, community, title, body, url, email, start, agree ("true")
//   files:       image (the picture, or the poster of a video ad), video
// Nobody logged in: refused with { ok: false, error: "login" } and nothing is saved.
import { getSessionUser } from "@/lib/session";
import { submitAd, type SubmitAdResult } from "@/lib/ad-submit";

export type CreateAdResult = SubmitAdResult | { ok: false; error: "login" };

const TEXT_FIELDS = ["format", "slot", "community", "title", "body", "url", "email", "start"] as const;

async function fileBytes(value: FormDataEntryValue | null): Promise<Uint8Array | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  return new Uint8Array(await value.arrayBuffer());
}

export async function createAd(form: FormData): Promise<CreateAdResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "login" };
  if (!(form instanceof FormData)) return { ok: false, error: "other" };

  const input: Record<string, unknown> = { agree: form.get("agree") === "true" };
  for (const key of TEXT_FIELDS) {
    const value = form.get(key);
    input[key] = typeof value === "string" ? value : null; // null makes cleanAdInput answer "type"
  }
  return submitAd(user.id, input, { image: await fileBytes(form.get("image")), video: await fileBytes(form.get("video")) });
}
