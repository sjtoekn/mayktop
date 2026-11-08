"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

// The top-bar account area: "Log in" + "Sign up" when nobody is logged in, otherwise the
// person's initial and a "Log out" button. It asks the browser (useSession) who is logged in,
// so the rest of the site can stay cached and fast.
export default function UserMenu({
  text,
}: {
  text: { login: string; signup: string; logout: string; label: string };
}) {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  if (isPending) return <span className="ch-avatarSm" aria-hidden="true">👤</span>;

  if (!session) {
    return (
      <>
        <Link href="/login" className="pc-pill pc-pill-sm">{text.login}</Link>
        <Link href="/signup" className="pc-pill pc-pill-sm">{text.signup}</Link>
      </>
    );
  }

  const initial = (session.user.name || session.user.email || "?").charAt(0).toUpperCase();
  return (
    <>
      <Link href="/settings" className="ch-avatarSm" title={session.user.name} aria-label={text.label}>
        {initial}
      </Link>
      <button
        type="button"
        className="pc-pill pc-pill-sm"
        onClick={async () => {
          await authClient.signOut();
          router.refresh();
        }}
      >
        {text.logout}
      </button>
    </>
  );
}
