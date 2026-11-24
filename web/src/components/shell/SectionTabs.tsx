"use client";

// The row of main sections under the header: Home, Community, Social, News, Shorts, Photos, Places, Explore.
// Every section has its own address and its own feed. On a phone the row scrolls sideways.
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

const TABS: { label: string; href: string; icon: string; also?: string[] }[] = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Community", href: "/community", icon: "users", also: ["/c/", "/post/", "/popular", "/top"] },
  { label: "Social", href: "/social", icon: "message-circle" },
  { label: "News", href: "/news", icon: "newspaper" },
  { label: "Shorts", href: "/shorts", icon: "play" },
  { label: "Photos", href: "/photos", icon: "image" },
  { label: "Places", href: "/places", icon: "mappin" },
  { label: "Explore", href: "/explore", icon: "compass" },
];

export default function SectionTabs({ label }: { label: string }) {
  const pathname = usePathname();
  const isActive = (tab: (typeof TABS)[number]) =>
    tab.href === "/"
      ? pathname === "/"
      : pathname === tab.href || pathname.startsWith(`${tab.href}/`) || (tab.also ?? []).some((p) => pathname.startsWith(p));

  return (
    <nav className="card st-bar" aria-label={label}>
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`st-tab${isActive(tab) ? " is-active" : ""}`}
          aria-current={isActive(tab) ? "page" : undefined}
        >
          <Icon name={tab.icon} size={18} />
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
