import { t } from "@/i18n";

// Shown while a page is being prepared. Skeleton cards keep the page from jumping.
export default function Loading() {
  return (
    <div className="sk-wrap" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{t("state.loading")}</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card sk-card" aria-hidden="true">
          <div className="sk sk-avatar" />
          <div className="sk-body">
            <div className="sk sk-line sk-w40" />
            <div className="sk sk-title" />
            <div className="sk sk-line sk-w90" />
            <div className="sk sk-line sk-w60" />
          </div>
        </div>
      ))}
    </div>
  );
}
