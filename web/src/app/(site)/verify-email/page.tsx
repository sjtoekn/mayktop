import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/shell/Icon";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("auth.verify.title") };

// Shown right after sign-up: the account exists, but the person must open the emailed link.
export default function VerifyEmailPage() {
  return (
    <section className="card pg-empty">
      <span className="pc-avatar pc-a1" aria-hidden="true"><Icon name="send" size={26} /></span>
      <h1 className="sf-h1">{t("auth.verify.title")}</h1>
      <p>{t("auth.verify.body")}</p>
      <Link href="/login" className="pc-btn">{t("topbar.login")}</Link>
    </section>
  );
}
