"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";

// The red number on the bell in the left menu (SOCIAL_TODO 21). It asks the browser who is logged in, then asks
// /notifications/count for the number, again at every page change, so the rest of the site can stay cached.
// Nobody logged in, or nothing unread: nothing is shown.
export default function NotificationBadge() {
  const { data: session } = authClient.useSession();
  const pathname = usePathname();
  const loggedIn = Boolean(session);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    fetch("/notifications/count", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { count: 0 }))
      .then((data: { count?: number }) => {
        if (!cancelled) setCount(Number(data.count) || 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loggedIn, pathname]);

  if (!loggedIn || count <= 0) return null;
  return <b className="ch-badge">{count > 99 ? "99+" : count}</b>;
}
