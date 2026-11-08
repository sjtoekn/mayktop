import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Icon from "@/components/shell/Icon";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("auth.verified.title") };

// Where the link in the verification email lands. Better Auth adds ?error=... when the link
// is wrong or expired (searchParams is read per request, so it sits inside <Suspense>).
async function Result({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (error) {
    return (
      <section className="card pg-empty">
        <span className="pc-avatar pc-a1" aria-hidden="true"><Icon name="compass" size={26} /></span>
        <h1 className="sf-h1">{t("auth.verify.title")}</h1>
        <p>{t("auth.verified.error")}</p>
        <Link href="/login" className="pc-btn">{t("topbar.login")}</Link>
      </section>
    );
  }
  return (
    <section className="card pg-empty">
      <span className="pc-avatar pc-a1" aria-hidden="true"><Icon name="shield" size={26} /></span>
      <h1 className="sf-h1">{t("auth.verified.title")}</h1>
      <p>{t("auth.verified.body")}</p>
      <Link href="/" className="pc-btn">{t("state.notFound.home")}</Link>
    </section>
  );
}

export default function EmailVerifiedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <Result searchParams={searchParams} />
    </Suspense>
  );
}
