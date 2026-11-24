// "Discover today": a PREVIEW of every part of the site, one card from each part in turn. Each card opens that part's own
// page, where its feed lives on its own (nothing is mixed on those pages).
import Link from "next/link";
import Icon from "@/components/shell/Icon";
import type { DiscoverCard, DiscoverData, DiscoverKind } from "@/lib/home-discover";

const KIND_ICON: Record<DiscoverKind, string> = {
  community: "users",
  social: "message-circle",
  shorts: "play",
  photos: "image",
  places: "mappin",
  news: "newspaper",
};
const ORDER: DiscoverKind[] = ["community", "shorts", "social", "photos", "places"];
const ALL_LIMIT = 12;

/** One from each part in turn: community, shorts, social, photos, places, then the second of each, and so on. */
function interleave(data: DiscoverData): DiscoverCard[] {
  const out: DiscoverCard[] = [];
  for (let round = 0; out.length < ALL_LIMIT && round < 4; round++) {
    for (const kind of ORDER) {
      const card = data[kind][round];
      if (card && out.length < ALL_LIMIT) out.push(card);
    }
  }
  return out;
}

export function CardBody({ card }: { card: DiscoverCard }) {
  const isCommunity = card.kind === "community";
  const hasMedia = isCommunity || card.kind === "shorts" || card.kind === "photos" || card.kind === "places" || card.kind === "news";
  const media = hasMedia ? (
    <div className={`hd-media hd-media-${card.kind}`} style={!card.image && card.art ? { background: card.art.gradient } : undefined}>
      {card.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- our own media routes, or a publisher's picture
        <img src={card.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      ) : card.art ? (
        <span className="hm-art" aria-hidden="true">
          <span className="hm-artEmoji">{card.art.emoji}</span>
        </span>
      ) : (
        <span className="hd-mediaIcon" aria-hidden="true">
          <Icon name={KIND_ICON[card.kind]} size={34} />
        </span>
      )}
      {card.kind === "shorts" ? (
        <>
          <span className="hd-flag">
            <Icon name="play" size={12} /> Shorts
          </span>
          {card.duration ? <span className="hd-duration">{card.duration}</span> : null}
        </>
      ) : null}
      {isCommunity && card.badge ? (
        <span className="hd-flag">
          {card.badge === "Video" ? <Icon name="play" size={12} /> : null} {card.badge}
        </span>
      ) : null}
      {isCommunity && card.badge === "Video" && card.image ? (
        <span className="hm-playDot" aria-hidden="true"><Icon name="play" size={22} /></span>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      {isCommunity ? media : null}
      <div className="hd-meta">
        <span className={`hd-badge hd-badge-${card.kind}`}>
          <Icon name={KIND_ICON[card.kind]} size={14} />
        </span>
        <span className="hd-source">{card.source}</span>
        {card.time ? <span className="hd-time">{card.time}</span> : null}
      </div>
      <h3 className="hd-title">{card.title}</h3>
      {card.excerpt ? <p className="hd-excerpt">{card.excerpt}</p> : null}
      {isCommunity ? null : media}
      {card.stats.length > 0 ? (
        <div className="hd-stats">
          {card.stats.map((s) => (
            <span key={s.icon}>
              <Icon name={s.icon} size={15} /> {s.value}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
}

export default function HomeDiscover({ data }: { data: DiscoverData }) {
  const cards = interleave(data);

  return (
    <section className="hd" aria-labelledby="hd-title">
      <div className="hd-head">
        <div className="hd-headLeft">
          <span className="hd-headIcon" aria-hidden="true">
            <Icon name="compass" size={22} />
          </span>
          <h2 id="hd-title">Discover today</h2>
        </div>
        <Link href="/explore" className="hd-all">
          See all <Icon name="arrowright" size={16} />
        </Link>
      </div>

      {cards.length === 0 ? (
        <p className="card hd-empty">
          Nothing here yet. <Link href="/explore">Open Explore</Link>
        </p>
      ) : (
        <ul className="hd-cols">
          {cards.map((card) => (
            <li key={card.key} className={`card hd-card hd-card-${card.kind}`}>
              <Link href={card.href} prefetch={false} className="hd-link">
                <CardBody card={card} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
