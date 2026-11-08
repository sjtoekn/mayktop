import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Icon from "@/components/shell/Icon";
import PasswordResetForm from "@/components/PasswordResetForm";
import { resetText } from "@/lib/auth-text";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("auth.reset.title") };

// Where the link in the reset email lands. Better Auth adds ?token=... when the link is good
// and ?error=... when it is wrong or expired (searchParams is read per request, so it sits
// inside <Suspense>). The token is only passed on to the form; it is never shown or stored.
async function Result({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  if (error || !token) {
    return (
      <section className="card pg-empty">
        <span className="pc-avatar pc-a1" aria-hidden="true"><Icon name="compass" size={26} /></span>
        <h1 className="sf-h1">{t("auth.reset.title")}</h1>
        <p>{t("auth.reset.error")}</p>
        <Link href="/forgot-password" className="pc-btn">{t("auth.forgot.again")}</Link>
      </section>
    );
  }
  return <PasswordResetForm mode="reset" token={token} text={resetText()} />;
}

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <Result searchParams={searchParams} />
    </Suspense>
  );
}
