"use client";

// true only when the browser has CONFIRMED that nobody is logged in (false while it is still
// asking, so the forms do not flash as "locked" on every page load). Used to lock the post and
// comment boxes so nobody writes a long text and then loses it. The server still refuses
// every save from a person who is not logged in; this is only for the person's comfort.
import { authClient } from "@/lib/auth-client";

export function useLoggedOut(): boolean {
  const { data, isPending } = authClient.useSession();
  return !isPending && !data;
}
