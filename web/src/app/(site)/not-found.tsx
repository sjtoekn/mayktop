import Link from "next/link";
import Icon from "@/components/shell/Icon";
import { t } from "@/i18n";

// Shown for unknown addresses and whenever a page calls notFound()
// (unknown community, post or profile). It sits inside the normal site frame.
export default function NotFound() {
  return (
    <section className="card pg-empty">
      <span className="pc-avatar pc-a1" aria-hidden="true"><Icon name="compass" size={26} /></span>
      <h1 className="sf-h1">{t("state.notFound.title")}</h1>
      <p>{t("state.notFound.text")}</p>
      <Link href="/" className="pc-btn">{t("state.notFound.home")}</Link>
    </section>
  );
}
