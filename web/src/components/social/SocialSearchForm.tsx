import Icon from "@/components/shell/Icon";
import { t } from "@/i18n";
import type { SearchTab } from "@/lib/social-search";

/**
 * The Social search box (SOCIAL_TODO B1): a plain GET form to /social/search (no script). `defaultValue` = the text
 * already searched. `tab` is sent along only when it is not Posts, so a search made on People stays on People; with no
 * tab the page picks one from the first character (# = Hashtags, @ = People). Server component.
 */
export default function SocialSearchForm({ defaultValue = "", tab = "posts" }: { defaultValue?: string; tab?: SearchTab }) {
  return (
    <form className="ss-form" action="/social/search" method="get" role="search">
      <div className="ch-search">
        <Icon name="search" size={20} />
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          maxLength={100}
          placeholder={t("social.search.placeholder")}
          aria-label={t("social.search.label")}
        />
      </div>
      {tab !== "posts" ? <input type="hidden" name="tab" value={tab} /> : null}
      <button type="submit" className="pc-btn">{t("social.search.button")}</button>
    </form>
  );
}
