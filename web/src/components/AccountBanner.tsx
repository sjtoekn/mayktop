"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { getAccountState, type AccountState } from "@/app/(site)/settings/actions";
import "@/app/(site)/settings/settings.css";

// A short notice at the top of every page when the logged-in person's account is limited
// (suspended, banned or waiting to be deleted). The page itself stays cached and shared: the
// browser asks after the page opens, and only when someone is logged in.
// All visible text comes in as props (translated on the server).
export default function AccountBanner({
  text,
}: {
  text: { suspended: string; deletion: string; link: string };
}) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const [state, setState] = useState<{ userId: string; value: AccountState | null } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let ignore = false;
    getAccountState()
      .then((value) => {
        if (!ignore) setState({ userId, value });
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [userId]);

  if (!userId || state?.userId !== userId) return null;
  if (state.value !== "SUSPENDED" && state.value !== "DELETION_PENDING") return null;

  return (
    <p className="ab-banner" role="status">
      {state.value === "SUSPENDED" ? text.suspended : text.deletion}{" "}
      <Link href="/settings">{text.link}</Link>
    </p>
  );
}
