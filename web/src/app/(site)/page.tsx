import "./home-discover.css";
import "./home-rows.css";
import { connection } from "next/server";
import HomeHero from "@/components/home/HomeHero";
import HomeRows from "@/components/home/HomeRows";
import { getHomeDiscover } from "@/lib/home-discover";

// HOME = the discovery page, one wide column (the left menu and the right column are hidden here, see shell.css .hm-home).
// It only PREVIEWS every part of the site, one row each (Community, Shorts, Photos, Social, News, Places); every part keeps
// its own feed on its own address.
export default async function HomePage() {
  await connection();
  const data = await getHomeDiscover();

  return (
    <div className="hm-home">
      <HomeHero />
      <HomeRows data={data} />
    </div>
  );
}
