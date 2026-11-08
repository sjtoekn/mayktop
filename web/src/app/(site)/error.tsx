"use client";

// Shown when something breaks while a page is shown. The rest of the site stays usable.
// Plain, blame-free wording: nothing the visitor did caused it.
import Link from "next/link";
import { useEffect } from "react";
import Icon from "@/components/shell/Icon";
import { t } from "@/i18n";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="card pg-empty" role="alert">
      <span className="pc-avatar pc-a4" aria-hidden="true"><Icon name="shield" size={26} /></span>
      <h1 className="sf-h1">{t("state.error.title")}</h1>
      <p>{t("state.error.text")}</p>
      <div className="fa-actions">
        <button type="button" className="pc-btn" onClick={() => reset()}>{t("state.error.retry")}</button>
        <Link href="/" className="fa-link">{t("state.notFound.home")}</Link>
      </div>
    </section>
  );
}
