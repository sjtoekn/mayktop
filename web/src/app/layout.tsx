import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./shell.css";
import "./header-phone.css";
import "./content.css";
import { siteConfig } from "@/config/site";
import { getDirection, getLocale, t } from "@/i18n";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: siteConfig.name,
  description: t("site.description"),
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
