"use client";

// The Home banner, full page width, ABOVE the three columns (left menu / feed / right column).
// It only shows on the Home page ("/"); every other page renders nothing here, so their layout is unchanged.
import "@/app/(site)/home-discover.css";
import { usePathname } from "next/navigation";
import HomeHero from "./HomeHero";

export default function HomeHeroSlot() {
  const pathname = usePathname();
  if (pathname !== "/") return null;
  return (
    <div className="ch-heroRow">
      <HomeHero />
    </div>
  );
}
