import Link from "next/link";
import Icon from "@/components/shell/Icon";
import { t } from "@/i18n";

// Phase 2 will list the signed-in person's saved posts. Until then: a clear empty state.
export default function SavedPage() {
  return (
    <>
      <header className="card pg-head">
        <h1 className="sf-h1">{t("saved.title")}</h1>
      </header>
      <section className="card pg-empty">
        <span className="pc-avatar pc-a1" aria-hidden="true"><Icon name="bookmark" size={26} /></span>
        <p>{t("saved.empty")}</p>
        <Link href="/" className="pc-btn">{t("saved.browse")}</Link>
      </section>
    </>
  );
}
