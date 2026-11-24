"use client";

// Marks the page frame as "this is the Home page" (shell.css hides the two side columns, home-rows.css widens the frame).
// Why not look for the Home page's own element (.hm-home) with CSS :has()? With cacheComponents the router keeps the pages you
// already visited in the DOM (hidden), so a hidden Home page stayed in the frame and the side columns stayed hidden on Community,
// Social and every other page until a reload. This flag follows the CURRENT address instead, so it is right on the first load
// (server render) and on every client-side move.
import { usePathname } from "next/navigation";

export default function HomeFlag() {
  const pathname = usePathname();
  return pathname === "/" ? <span className="ch-homeFlag" hidden /> : null;
}
