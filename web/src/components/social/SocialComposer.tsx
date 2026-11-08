import Icon from "@/components/shell/Icon";
import { t } from "@/i18n";

/**
 * Quick composer on the Social pages: avatar, a text box and a Post button.
 * A plain form: Post opens /social/submit and carries the typed text with it (?body=...).
 * Styles: .sf-composer* in app/content.css.
 */
export default function SocialComposer() {
  return (
    <section className="card sf-composer">
      <div className="sf-composerAvatar" aria-hidden="true">👤</div>
      <form action="/social/submit" method="get" className="sf-composerForm">
        <input
          name="body"
          maxLength={5000}
          placeholder={t("home.composer.placeholder")}
          aria-label={t("home.composer.placeholder")}
        />
        <button type="submit" className="sf-composerBtn" aria-label={t("home.composer.post")}>
          <Icon name="send" size={20} /> <span className="sf-composerLabel">{t("home.composer.post")}</span>
        </button>
      </form>
    </section>
  );
}
