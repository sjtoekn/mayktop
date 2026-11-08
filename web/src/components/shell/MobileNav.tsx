"use client";

// Phone navigation (shown below 800px, where the left sidebar is hidden):
// a fixed bottom bar (Home, Explore, New post, Saved, More). "More" opens a panel
// with everything else, so every page the sidebar reaches is reachable on a phone.
// The <details> is keyed by the path, so it closes itself after you pick a page.
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import type { CommunityChip, NavItem } from "./Sidebar";

const BAR = ["/", "/explore", "/saved"];

export default function MobileNav({
  nav,
  more,
  communities,
  communitiesTitle,
  communitiesHref,
  soonLabel,
  createLabel,
  moreLabel,
  mainLabel,
}: {
  nav: NavItem[];
  more: NavItem[];
  communities: CommunityChip[];
  communitiesTitle: string;
  communitiesHref: string;
  soonLabel: string;
  createLabel: string;
  moreLabel: string;
  mainLabel: string;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const inBar = (n: NavItem) => BAR.includes(n.href) && !n.disabled;
  const bar = BAR.map((href) => nav.find((n) => n.href === href && inBar(n))).filter(
    (n): n is NavItem => Boolean(n),
  );
  const rest = [...nav.filter((n) => !inBar(n)), ...more];
  const item = (n: NavItem) => (
    <Link
      key={n.label}
      href={n.href}
      className={`mn-item ${isActive(n.href) ? "mn-active" : ""}`}
      aria-current={isActive(n.href) ? "page" : undefined}
    >
      <Icon name={n.icon} size={24} />
      <span>{n.label}</span>
    </Link>
  );

  return (
    <nav className="mn-bar" aria-label={mainLabel}>
      {bar.slice(0, 2).map(item)}
      <Link href="/submit" className={`mn-item mn-create ${isActive("/submit") ? "mn-active" : ""}`}>
        <Icon name="pencil" size={24} />
        <span>{createLabel}</span>
      </Link>
      {bar.slice(2).map(item)}

      <details className="mn-more" key={pathname}>
        <summary className="mn-item">
          <Icon name="grid" size={24} />
          <span>{moreLabel}</span>
        </summary>
        <div className="mn-panel">
          {rest.map((n) =>
            n.disabled ? (
              <span key={n.label} className="ch-navItem ch-disabled" aria-disabled="true">
                <Icon name={n.icon} />
                <span>{n.label}</span>
                <small className="ch-soon">{soonLabel}</small>
              </span>
            ) : (
              <Link
                key={n.label}
                href={n.href}
                className={`ch-navItem ${isActive(n.href) ? "ch-navActive" : ""}`}
                aria-current={isActive(n.href) ? "page" : undefined}
              >
                <Icon name={n.icon} />
                <span>{n.label}</span>
              </Link>
            ),
          )}
          <hr className="ch-hr" />
          <h4 className="ch-catTitle"><Link href={communitiesHref}>{communitiesTitle}</Link></h4>
          <div className="ch-cats">
            {communities.map((c, i) => (
              <Link
                key={c.slug}
                href={`/c/${c.slug}`}
                className={`ch-cat ch-cat-${(i % 5) + 1} ${isActive(`/c/${c.slug}`) ? "ch-cat-active" : ""}`}
              >
                <Icon name={c.icon} size={18} />
                <span>{c.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </details>
    </nav>
  );
}
