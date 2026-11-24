// The Home page body: ONE ROW PER PART OF THE SITE, the same family look as MaykTop's Home.
// Order: Community first (communities get priority), then Shorts, Photos, Social, News, Places; then "Best of the community"
// + "Communities to explore" side by side, and the promise strip. Home only PREVIEWS: every row has a "See all" link to
// that part's own page, where its feed lives on its own. Server component.
import Link from "next/link";
import { Suspense } from "react";
import Icon from "@/components/shell/Icon";
import BestOf from "@/components/shell/BestOf";
import CommunityAdCard from "@/components/home/CommunityAdCard";
import { adsConfig } from "@/config/site";
import { CardBody } from "@/components/home/HomeDiscover";
import { communityIcon } from "@/data/sample";
import { getCommunities } from "@/lib/queries";
import { t } from "@/i18n";
import type { DiscoverCard, DiscoverData, DiscoverKind } from "@/lib/home-discover";

const ROWS: { kind: DiscoverKind; title: string; hint: string; icon: string; href: string }[] = [
  { kind: "community", title: "Community", hint: "Questions and answers from people who know", icon: "users", href: "/community" },
  { kind: "shorts", title: "Shorts", hint: "Quick videos picked for you", icon: "play", href: "/shorts" },
  { kind: "photos", title: "Photos", hint: "Fresh pictures from the community", icon: "image", href: "/photos" },
  { kind: "social", title: "Social", hint: "What people are saying right now", icon: "message-circle", href: "/social" },
  { kind: "news", title: "News", hint: "Headlines from approved publishers", icon: "newspaper", href: "/news" },
  { kind: "places", title: "Places", hint: "Places worth knowing about", icon: "mappin", href: "/places" },
];

function RowHead({ id, title, hint, icon, href }: { id: string; title: string; hint: string; icon: string; href: string }) {
  return (
    <div className="hd-head">
      <div className="hd-headLeft">
        <span className="hd-headIcon" aria-hidden="true">
          <Icon name={icon} size={22} />
        </span>
        <div className="hm-headText">
          <h2 id={id}>{title}</h2>
          <p>{hint}</p>
        </div>
      </div>
      <Link href={href} className="hd-all">
        See all <Icon name="arrowright" size={16} />
      </Link>
    </div>
  );
}

function ShortsRow({ cards }: { cards: DiscoverCard[] }) {
  return (
    <ul className="hm-shorts">
      {cards.map((c) => (
        <li key={c.key} className="hm-short">
          <Link href={c.href} prefetch={false} aria-label={c.title}>
            <span className="hm-shortMedia">
              {c.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- our own media route
                <img src={c.image} alt="" loading="lazy" decoding="async" />
              ) : null}
              <span className="hd-flag"><Icon name="play" size={12} /> Shorts</span>
              {c.duration ? <span className="hd-duration">{c.duration}</span> : null}
              <span className="hm-shortPlay" aria-hidden="true"><Icon name="play" size={26} /></span>
              <span className="hm-shortInfo">
                <span className="hm-shortTitle">{c.title}</span>
                <span className="hm-shortBy">
                  <span className="hm-shortAvatar" aria-hidden="true">{(Array.from(c.source.trim())[0] ?? "?").toUpperCase()}</span>
                  {c.source}
                </span>
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PhotosRow({ cards }: { cards: DiscoverCard[] }) {
  return (
    <ul className="hm-photos">
      {cards.map((c) => (
        <li key={c.key} className="hm-photo">
          <Link href={c.href} prefetch={false} aria-label={c.title}>
            {c.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- our own media route
              <img src={c.image} alt="" loading="lazy" decoding="async" />
            ) : (
              <span className="hm-mediaIcon" aria-hidden="true"><Icon name="image" size={34} /></span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// The Community row: the 5th card is ALWAYS an ad (CommunityAdCard). So only the first 4 posts are shown, then the ad.
const COMMUNITY_AD_AT = 5; // 1-based place of the ad card in the Community row
function CardsRow({ cards, withAd = false }: { cards: DiscoverCard[]; withAd?: boolean }) {
  const posts = withAd ? cards.slice(0, COMMUNITY_AD_AT - 1) : cards;
  return (
    <ul className="hm-cards">
      {posts.map((c) => (
        <li key={c.key} className={`card hd-card hd-card-${c.kind}`}>
          {c.kind === "news" ? (
            <a href={c.href} target="_blank" rel="noopener noreferrer" className="hd-link">
              <CardBody card={c} />
            </a>
          ) : (
            <Link href={c.href} prefetch={false} className="hd-link">
              <CardBody card={c} />
            </Link>
          )}
        </li>
      ))}
      {withAd ? (
        <CommunityAdCard
          noRepeatMinutes={adsConfig.rotation.noRepeatMinutes}
          labels={{ badge: t("ad.badge"), label: t("ad.label"), houseTitle: t("ad.house.title"), houseBody: t("ad.house.body") }}
        />
      ) : null}
    </ul>
  );
}

export default async function HomeRows({ data }: { data: DiscoverData }) {
  const communities = await getCommunities();
  const toExplore = [...communities].sort((a, b) => b.members - a.members).slice(0, 4);

  return (
    <>
      {/* Communities: quick chips + create (the left menu's list, moved into the page) */}
      <nav className="hm-chips" aria-label="Communities">
        <ul>
          {communities.map((c, i) => (
            <li key={c.slug}>
              <Link href={`/c/${c.slug}`} className={`hm-chip ch-cat-${(i % 5) + 1}`}>
                <Icon name={communityIcon[c.slug] ?? "users"} size={18} /> {c.name}
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/communities/new" className="hm-create">
          <Icon name="users" size={18} /> Create community
        </Link>
      </nav>

      {ROWS.map((row) => {
        const cards = data[row.kind];
        // Community always shows (with a way in when empty); the other rows simply skip when they have nothing yet.
        if (cards.length === 0 && row.kind !== "community") return null;
        return (
          <div key={row.kind} className="hm-block">
            <section className={`hd hm-sec hm-sec-${row.kind}`} aria-labelledby={`hm-${row.kind}`}>
              <RowHead id={`hm-${row.kind}`} {...row} />
              {cards.length === 0 ? (
                <p className="card hd-empty">
                  Nothing here yet. <Link href={row.href}>Open {row.title}</Link>
                </p>
              ) : row.kind === "shorts" ? (
                <ShortsRow cards={cards} />
              ) : row.kind === "photos" ? (
                <PhotosRow cards={cards} />
              ) : (
                <CardsRow cards={cards} withAd={row.kind === "community"} />
              )}
            </section>
          </div>
        );
      })}

      <div className="hm-band">
        <Suspense fallback={<section className="card ch-bestof" aria-busy="true" />}>
          <BestOf />
        </Suspense>
        {toExplore.length > 0 ? (
          <section className="card ce" aria-labelledby="hm-ce-title">
            <div className="ce-head">
              <h3 id="hm-ce-title"><Icon name="users" size={20} /> Communities to explore</h3>
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
      </div>

      <section className="hm-promise" aria-label={t("promise.title")}>
        <strong>{t("promise.title")}</strong>
        <ul>
          <li>{t("promise.1")}</li>
          <li>{t("promise.2")}</li>
          <li>{t("promise.3")}</li>
        </ul>
      </section>
    </>
  );
}
