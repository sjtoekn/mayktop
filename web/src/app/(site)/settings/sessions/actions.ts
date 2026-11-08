"use server";

// Log other devices out (TODO 32, patch-39). The browser is not trusted: every call checks who is
// logged in, and a device can only be logged out when it belongs to that same person. The
// secret session token never goes to the browser; the page only knows each session's id.
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export type SessionResult = { ok: true } | { error: true };

/** Log ONE other device out. The device you are using now is refused (use "Log out" in the top bar). */
export async function logOutDevice(input: { id: string }): Promise<SessionResult> {
  if (typeof input?.id !== "string" || input.id.length === 0 || input.id.length > 100) {
    return { error: true };
  }
  const user = await getSessionUser();
  if (!user) return { error: true };

  try {
    const h = await headers();
    const current = await auth.api.getSession({ headers: h });
    const target = await prisma.session.findFirst({
      where: { id: input.id, userId: user.id },
      select: { id: true, token: true },
    });
    if (!target || target.id === current?.session.id) return { error: true };
    await auth.api.revokeSession({ body: { token: target.token }, headers: h });
    return { ok: true };
  } catch (error) {
    console.error("logOutDevice failed:", error);
    return { error: true };
  }
}

/** Log every device out except the one in use. */
export async function logOutOtherDevices(): Promise<SessionResult> {
  const user = await getSessionUser();
  if (!user) return { error: true };
  try {
    await auth.api.revokeOtherSessions({ headers: await headers() });
    return { ok: true };
  } catch (error) {
    console.error("logOutOtherDevices failed:", error);
    return { error: true };
  }
}
