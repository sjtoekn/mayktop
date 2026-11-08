"use client";
// Left menu of the admin panel. Each new part (People, Reports, ...) adds one item in app/admin/layout.tsx.
import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminNavItem = { href: string; label: string };

export default function AdminNav({ items, label }: { items: AdminNavItem[]; label: string }) {
  const path = usePathname();
  return (
    <nav className="ad-nav" aria-label={label}>
      <ul>
        {items.map((item) => {
          const on = item.href === "/admin" ? path === "/admin" : path.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link href={item.href} className="ad-navlink" aria-current={on ? "page" : undefined}>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
