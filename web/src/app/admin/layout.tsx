import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import "./admin.css";
import { siteConfig } from "@/config/site";
import { t } from "@/i18n";
import { requireAdmin } from "@/lib/admin";
import AdminNav, { type AdminNavItem } from "@/components/admin/AdminNav";
import ThemeToggle from "@/components/shell/ThemeToggle";

export const metadata: Metadata = {
  title: t("admin.title"),
  robots: { index: false, follow: false }, // never shown in search engines
};

async function AdminFrame({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  // One item per finished part (admin.md). Parts 5 and 9 add Reports, Audit, ...
  const items: AdminNavItem[] = [
    { href: "/admin", label: t("admin.nav.overview") },
    { href: "/admin/people", label: t("admin.nav.people") },
    { href: "/admin/bans", label: t("admin.nav.bans") },
    { href: "/admin/review", label: t("admin.nav.review") },
    { href: "/admin/social", label: t("admin.nav.social") },
    { href: "/admin/appeals", label: t("admin.nav.appeals") },
    { href: "/admin/communities", label: t("admin.nav.communities") },
    { href: "/admin/ads", label: t("admin.nav.ads") },
    { href: "/admin/payouts", label: t("admin.nav.payouts") },
    { href: "/admin/news", label: "News sources" },
  ];
  if (me.isSuperAdmin) items.push({ href: "/admin/team", label: t("admin.nav.team") }); // only the super admin sees this

  return (
    <div className="ad-root">
      <aside className="card ad-side">
        <Link href="/admin" className="ad-brand">
          <span className="ad-brandName">
            {siteConfig.nameStart}
            <b>{siteConfig.nameAccent}</b>
          </span>
          <span className="pc-badge pc-badge-info ad-brandTag">{t("admin.title")}</span>
        </Link>
        <AdminNav items={items} label={t("admin.nav.label")} />
        <Link href="/" className="btn btn-ghost btn-sm ad-back">
          {t("admin.nav.site")}
        </Link>
      </aside>

      <div className="ad-main">
        <header className="card ad-top">
          <span className="pc-meta">{t("admin.signedIn", { name: me.username })}</span>
          <ThemeToggle label={t("home.theme")} />
        </header>
        <main id="admin-main" className="ad-content">
          {children}
        </main>
      </div>
    </div>
  );
}

// The login check reads the request, so everything that depends on it sits inside <Suspense>.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AdminFrame>{children}</AdminFrame>
    </Suspense>
  );
}
