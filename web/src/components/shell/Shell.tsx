// THE one page frame for the whole site: header + left sidebar + right column.
// Every page is rendered inside <main>. Mounted once in app/layout.tsx.
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { siteConfig } from "@/config/site";
import { communityIcon } from "@/data/sample";
import { getCommunities } from "@/lib/queries";
import { currentUsername } from "@/data/profiles";
import { t } from "@/i18n";
import AdSlot from "@/components/AdSlot";
import Icon from "./Icon";
import ThemeToggle from "./ThemeToggle";
import Sidebar, { type NavItem } from "./Sidebar";
import MobileNav from "./MobileNav";
import UserMenu from "./UserMenu";
import BestOf from "./BestOf";
import SectionTabs from "./SectionTabs";
import HomeFlag from "./HomeFlag";

export default async function Shell({ children }: { children: ReactNode }) {
  const communities = await getCommunities();
  // The main sections (Community, Social, News, Shorts, Photos, Places, Explore) are in the tab row under the header
  // (SectionTabs). The sidebar keeps only the personal links; Popular and Top (Community rankings) moved to "more".
  const nav: NavItem[] = [
    { icon: "bookmark", label: t("nav.saved"), href: "/saved" },
    { icon: "bell", label: t("nav.notifications"), href: "/notifications" },
    { icon: "user", label: t("nav.profile"), href: `/u/${currentUsername}` },
  ];
  // Home and Explore are only in the tab row on a wide screen (one place for the main navigation). The phone bottom bar
  // has no tab row of its own, so it gets them from this list.
  const mobileNav: NavItem[] = [
    { icon: "home", label: t("nav.home"), href: "/" },
    { icon: "compass", label: t("nav.explore"), href: "/explore" },
    ...nav,
  ];
  const more: NavItem[] = [
    { icon: "users", label: "Create community", href: "/communities/new", cta: true }, // TODO: move this label into the i18n files (see community-request-text.ts)
    { icon: "megaphone", label: t("nav.advertise"), href: "/advertise" },
    { icon: "flame", label: t("nav.popular"), href: "/popular" },
    { icon: "trophy", label: t("nav.top"), href: "/top" },
    { icon: "shield", label: t("nav.modlog"), href: "/modlog" },
    { icon: "scale", label: t("nav.fairness"), href: "/fairness" },
  ];
  // "Communities to explore" (right column): the three biggest communities by members.
  const toExplore = [...communities].sort((a, b) => b.members - a.members).slice(0, 3);

  return (
    <div className="ch-root">
      <a href="#main" className="skip-link">{t("a11y.skip")}</a>
      {/* The header banner ad: the very top of the page, as wide as the header and the three columns (same max-width). */}
      <AdSlot variant="header" />

      <div className="ch-top">
      <header className="ch-header">
        <Link href="/" className="card ch-logoBox">
          <span className="ch-logoIcon" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- the small brand mark (public/brand), shown at 54x48 */}
            <img src="/brand/falvenco-mark.png" width={54} height={48} alt="" decoding="async" />
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

      <SectionTabs label="Sections" />
      </div>

      <div className="ch-layout">
        <HomeFlag />
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
          <Suspense fallback={<section className="card ch-bestof" aria-busy="true" />}>
            <BestOf />
          </Suspense>

          {toExplore.length > 0 ? (
            <section className="card ce" aria-labelledby="ce-title">
              <div className="ce-head">
                <h3 id="ce-title"><Icon name="users" size={20} /> Communities to explore</h3>
                <Link href="/explore" className="ce-all">See all →</Link>
              </div>
              {toExplore.map((c) => (
                <div key={c.slug} className="ce-row">
                  <span className="ce-ico" aria-hidden="true"><Icon name={communityIcon[c.slug] ?? "users"} size={22} /></span>
                  <span className="ce-name"><strong>{c.name}</strong><small>{c.members.toLocaleString("en")} {c.members === 1 ? "member" : "members"}</small></span>
                  <Link href={`/c/${c.slug}`} className="ce-view">View</Link>
                </div>
              ))}
            </section>
          ) : null}

          <AdSlot variant="sidebar" />

          <section className="card ch-promise">
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
        nav={mobileNav}
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
