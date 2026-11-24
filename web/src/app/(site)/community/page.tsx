import "../home.css";
import { connection } from "next/server";
import PostCard from "@/components/PostCard";
import AdSlot, { isFeedAdPosition } from "@/components/AdSlot";
import Icon from "@/components/shell/Icon";
import { t } from "@/i18n";
import { getHomeFeed } from "@/lib/queries";

export const metadata = { title: "Community | Falvenco" };

// The Community feed (questions, articles, videos from the communities). It used to be the Home page; Home is now the
// discovery page (app/(site)/page.tsx) and every part of the site keeps its own feed on its own address.
export default async function CommunityPage() {
  await connection();
  const feed = await getHomeFeed(false);

  return (
    <>
      <section className="ch-banner">
        <div>
          <h1>{t("home.banner.title")}</h1>
          <p>{t("home.banner.sub")}</p>
        </div>
        <div className="ch-bannerArt" aria-hidden="true">
          {/* Fixed illustration colours: the banner looks the same in light and dark mode. */}
          <svg viewBox="0 -14 150 124" xmlns="http://www.w3.org/2000/svg">
            <g stroke="#ffc233" strokeWidth="4" strokeLinecap="round">
              <line x1="75" y1="-12" x2="75" y2="-3" /><line x1="48" y1="-5" x2="54" y2="2" /><line x1="102" y1="-5" x2="96" y2="2" />
            </g>
            <circle cx="30" cy="54" r="13" fill="#1f5eff" />
            <path d="M2 110C2 86 15 73 30 73s28 13 28 37z" fill="#1f5eff" />
            <circle cx="120" cy="54" r="13" fill="#ff7a2f" />
            <path d="M92 110c0-24 13-37 28-37s28 13 28 37z" fill="#ff7a2f" />
            <circle cx="75" cy="30" r="18" fill="#1b4fd6" />
            <path d="M33 110c0-40 15-56 42-56s42 16 42 56z" fill="#1b4fd6" />
          </svg>
        </div>
      </section>

      <section className="card ch-composer">
        <div className="ch-avatarMd">👤</div>
        {/* A plain form: Post opens /submit and carries the typed title with it (?title=...). */}
        <form action="/submit" method="get" className="contents">
          <input
            name="title"
            maxLength={120}
            placeholder={t("home.composer.placeholder")}
            aria-label={t("home.composer.placeholder")}
          />
          <button type="submit" className="ch-postBtn" aria-label={t("home.composer.post")}><Icon name="send" size={20} /> <span className="ch-postLabel">{t("home.composer.post")}</span></button>
        </form>
      </section>

      {/* Community posts only. Social posts are at /social, Shorts at /shorts, Photos at /photos. */}
      {feed.map((item, index) => item.kind === "community" ? (
        <div key={`community-${item.post.id}`} className="contents">
          <PostCard post={item.post} />
          {isFeedAdPosition(index) && <AdSlot variant="feed" />}
        </div>
      ) : null)}
    </>
  );
}
