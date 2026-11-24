import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./shell.css";
import "./header-phone.css";
import "./content.css";
import { siteConfig } from "@/config/site";
import { getDirection, getLocale, t } from "@/i18n";
import { getSiteUrl, isSiteIndexable } from "@/lib/site-url";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()), // makes every relative address in page headers a full one
  title: siteConfig.name,
  description: t("site.description"),
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: t("site.description"),
    images: [{ url: "/brand/falvenco-logo.png", width: 219, height: 224, alt: siteConfig.name }],
  },
  twitter: { card: "summary", images: ["/brand/falvenco-logo.png"] },
  // Until SITE_URL is a real https address, search engines are told to stay away (see src/lib/site-url.ts).
  ...(isSiteIndexable() ? {} : { robots: { index: false, follow: false } }),
};

// The root layout is only <html> + <body>. The public page frame (header, sidebar, right column)
// lives in app/(site)/layout.tsx; the admin panel has its own frame in app/admin/layout.tsx.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={getLocale()} dir={getDirection()} suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before the page paints, so there is no light flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}',
          }}
        />
      </head>
      <body
        className={`${inter.variable} min-h-screen bg-page text-ink antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
