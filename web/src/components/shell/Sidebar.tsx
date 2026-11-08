"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import NotificationBadge from "./NotificationBadge";

export type NavItem = { icon: string; label: string; href: string; badge?: number; disabled?: boolean };
export type CommunityChip = { slug: string; label: string; icon: string };

export default function Sidebar({
  nav,
  more,
  communities,
  communitiesTitle,
  communitiesHref,
  soonLabel,
  mainLabel,
  infoLabel,
}: {
  nav: NavItem[];
  more: NavItem[];
  communities: CommunityChip[];
  communitiesTitle: string;
  communitiesHref: string;
  soonLabel: string;
  mainLabel: string;
  infoLabel: string;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="card ch-sidebar">
      <nav aria-label={mainLabel}>
        {nav.map((n) => n.disabled ? (
          <span key={n.label} className="ch-navItem ch-disabled" aria-disabled="true">
            <Icon name={n.icon} />
            <span>{n.label}</span>
            <small className="ch-soon">{soonLabel}</small>
          </span>
        ) : (
          <Link key={n.label} href={n.href}
            className={`ch-navItem ${isActive(n.href) ? "ch-navActive" : ""}`}
            aria-current={isActive(n.href) ? "page" : undefined}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
            {n.href === "/notifications" ? <NotificationBadge /> : n.badge ? <b className="ch-badge">{n.badge}</b> : null}
          </Link>
        ))}
      </nav>

      <hr className="ch-hr" />
      <h4 className="ch-catTitle"><Link href={communitiesHref}>{communitiesTitle}</Link></h4>
      <div className="ch-cats">
        {communities.map((c, i) => (
          <Link key={c.slug} href={`/c/${c.slug}`}
            className={`ch-cat ch-cat-${(i % 5) + 1} ${isActive(`/c/${c.slug}`) ? "ch-cat-active" : ""}`}>
            <Icon name={c.icon} size={18} />
            <span>{c.label}</span>
          </Link>
        ))}
      </div>

      <hr className="ch-hr" />
      <nav aria-label={infoLabel}>
        {more.map((n) => (
          <Link key={n.label} href={n.href} className="ch-more">
            <Icon name={n.icon} size={18} />
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
