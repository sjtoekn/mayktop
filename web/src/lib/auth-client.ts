"use client";

// The browser side of Better Auth: reads who is logged in (useSession) and logs out.
// Signing up and logging in go through server actions (src/app/auth/actions.ts).
// inferAdditionalFields makes `session.user.username` known to TypeScript (the Edit / Delete
// buttons use it to show themselves only on the person's own posts and comments).
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});
