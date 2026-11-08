// THE one page frame for the whole site: header + left sidebar + right column.
// Every page is rendered inside <main>. Mounted once in app/layout.tsx.
import Link from "next/link";
import type { ReactNode } from "react";
import { siteConfig } from "@/config/site";
import { communityIcon } from "@/data/sample";
import { getCommunities } from "@/lib/queries";
import { currentUsername } from "@/data/profiles";
import { formatCompact, formatNumber, t } from "@/i18n";
import { trendingTopics } from "@/data/sample";
import AdSlot from "@/components/AdSlot";
import Icon from "./Icon";
import ThemeToggle from "./ThemeToggle";
import Sidebar, { type NavItem } from "./Sidebar";
import MobileNav from "./MobileNav";
import UserMenu from "./UserMenu";

export default async function Shell({ children }: { children: ReactNode }) {
  const communities = await getCommunities();
  const nav: NavItem[] = [
    { icon: "home", label: t("nav.home"), href: "/" },
    { icon: "comment", label: t("nav.social"), href: "/social" },
    { icon: "newspaper", label: "News", href: "/news" },
    { icon: "flame", label: t("nav.popular"), href: "/popular" },
    { icon: "compass", label: t("nav.explore"), href: "/explore" },
    { icon: "trophy", label: t("nav.top"), href: "/top" },
    { icon: "bookmark", label: t("nav.saved"), href: "/saved" },
    { icon: "bell", label: t("nav.notifications"), href: "/notifications" },
    { icon: "user", label: t("nav.profile"), href: `/u/${currentUsername}` },
  ];
  const more: NavItem[] = [
    { icon: "shield", label: t("nav.modlog"), href: "/modlog" },
    { icon: "scale", label: t("nav.fairness"), href: "/fairness" },
  ];

  return (
    <div className="ch-root">
      <a href="#main" className="skip-link">{t("a11y.skip")}</a>
      <header className="ch-header">
        <Link href="/" className="card ch-logoBox">
          <span className="ch-logoIcon" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="8.5" cy="9" r="2.4" /><circle cx="15.5" cy="9" r="2.4" />
              <path d="M4.5 16.5c0-2.2 1.8-3.6 4-3.6s4 1.4 4 3.6zM11.5 16.5c0-2.2 1.8-3.6 4-3.6s4 1.4 4 3.6z" />
            </svg>
          </span>
          <span className="ch-logoText" aria-label={siteConfig.name}>
            {siteConfig.nameStart}<b>{siteConfig.nameAccent}</b>
          </span>
        </Link>
        <div className="card ch-topbar">
          <form className="ch-search" action="/search" method="get" role="search">
            <Icon name="search" size={20} />
            <input type="search" name="q" maxLength={100} placeholder={t("home.search.placeholder")} aria-label={t("topbar.search.label")} />
          </form>
          <div className="ch-topRight">
            <ThemeToggle label={t("home.theme")} />
            <UserMenu
              text={{
                login: t("topbar.login"),
                signup: t("topbar.signup"),
                logout: t("auth.logout"),
                label: t("auth.menu.label"),
              }}
            />
          </div>
        </div>
      </header>

      <div className="ch-layout">
        <Sidebar
          nav={nav}
          more={more}
          communities={communities.map((c) => ({ slug: c.slug, label: c.name, icon: communityIcon[c.slug] ?? "users" }))}
          communitiesTitle={t("nav.communities")}
          communitiesHref="/explore"
          soonLabel={t("nav.soon")}
          mainLabel={t("a11y.nav.main")}
          infoLabel={t("a11y.nav.info")}
        />

        <main id="main" tabIndex={-1} className="ch-feed">{children}</main>

        <aside className="ch-right">
          <section className="card ch-trending">
            <h3><span className="ch-fire">🔥</span> {t("home.trending")}</h3>
            {trendingTopics.map((tr) => (
              <div key={tr.rank} className="ch-trendItem">
                <b className="ch-rank">{formatNumber(tr.rank)}</b>
                <div>
                  <strong>{tr.title}</strong>
                  <small>{t("home.views", { n: formatCompact(tr.views) })}</small>
                </div>
                <div className="ch-thumb" style={{ background: tr.gradient }}>{tr.emoji}</div>
              </div>
            ))}
          </section>

          <section className="card ch-join">
            <h3><Icon name="users" size={26} /> {t("home.join.title")}</h3>
            <p>{t("home.join.sub")}</p>
            <button className="ch-joinBtn">{t("home.join.button")} <Icon name="chevron" size={20} /></button>
          </section>

          <AdSlot variant="sidebar" />

          <section className="card">
            <h3 className="type-heading mb-2">{t("promise.title")}</h3>
            <ul className="type-small space-y-2">
              <li>{t("promise.1")}</li>
              <li>{t("promise.2")}</li>
              <li>{t("promise.3")}</li>
            </ul>
          </section>
        </aside>
      </div>

      <MobileNav
        nav={nav}
        more={more}
        communities={communities.map((c) => ({ slug: c.slug, label: c.name, icon: communityIcon[c.slug] ?? "users" }))}
        communitiesTitle={t("nav.communities")}
        communitiesHref="/explore"
        soonLabel={t("nav.soon")}
        createLabel={t("home.createPost")}
        moreLabel={t("nav.more")}
        mainLabel={t("a11y.nav.main")}
      />
    </div>
  );
}
