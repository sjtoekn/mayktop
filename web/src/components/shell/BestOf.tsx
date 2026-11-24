// The right-column box "Best of the community" (replaces the fake "Trending Now"). Server part: reads the shared,
// cached data (src/lib/best-of.ts), turns it into slides with translated text, and hands them to the rotator.
import { bestOfConfig } from "@/config/best-of";
import { getBestOf } from "@/lib/best-of";
import { communityArt, defaultArt } from "@/data/sample";
import { t } from "@/i18n";
import BestOfRotator, { type Slide, type SlideItem } from "./BestOfRotator";

const GRADIENTS = [
  "linear-gradient(135deg,#7fd8ff,#2ec4b6)",
  "linear-gradient(135deg,#ffd28a,#e07a1f)",
  "linear-gradient(135deg,#3a86ff,#0a1f5c)",
  "linear-gradient(135deg,#ffe27a,#f5a300)",
  "linear-gradient(135deg,#c7b8ff,#6d4aff)",
  "linear-gradient(135deg,#ff9fb2,#d6336c)",
];

function gradientFor(key: string): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

const letterOf = (name: string) => (Array.from(name.trim())[0] ?? "?").toUpperCase();

function short(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const chars = Array.from(flat);
  return chars.length <= max ? flat : `${chars.slice(0, max).join("").trimEnd()}…`;
}

export default async function BestOf() {
  const data = await getBestOf();
  const newLabel = t("home.bestof.new");
  const slides: Slide[] = [];

  const add = (key: string, emoji: string, items: SlideItem[]) => {
    if (items.length === 0) return;
    slides.push({
      key,
      emoji,
      label: t(`home.bestof.tab.${key}` as "home.bestof.tab.helpers"),
      title: t(`home.bestof.${key}.title` as "home.bestof.helpers.title"),
      sub: t(`home.bestof.${key}.sub` as "home.bestof.helpers.sub"),
      items,
    });
  };

  add(
    "helpers",
    "🏆",
    data.helpers.map((p) => ({
      key: p.username,
      href: `/u/${p.username}`,
      title: p.name,
      sub: p.helpful > 0 ? t("home.bestof.helpful", { n: String(p.helpful) }) : "",
      badge: p.isNew ? newLabel : undefined,
      letter: letterOf(p.name),
      gradient: gradientFor(p.username),
    })),
  );
  add(
    "topics",
    "💬",
    data.topics.map((c) => ({
      key: c.slug,
      href: `/c/${c.slug}`,
      title: c.name,
      sub: t("home.bestof.talking", { n: String(c.people) }),
      emoji: c.emoji,
      gradient: c.gradient,
    })),
  );
  add(
    "posts",
    "📚",
    data.posts.map((p) => {
      const art = communityArt[p.communitySlug] ?? defaultArt;
      return {
      key: `p${p.id}`,
      href: `/post/${p.id}`,
      title: short(p.title, 90),
      sub: `${p.communityName} · ${t("home.bestof.answers", { n: String(p.comments) })}`,
      badge: p.isNew ? newLabel : undefined,
      emoji: art.emoji,
      gradient: art.gradient,
      };
    }),
  );
  add(
    "social",
    "🗨️",
    data.social.map((p) => ({
      key: `s${p.id}`,
      href: `/social/${p.id}`,
      title: short(p.text, 90),
      sub: `${t("home.bestof.by", { name: p.name })} · ${t("home.bestof.likes", { n: String(p.likes) })}`,
      badge: p.isNew ? newLabel : undefined,
      emoji: "✨",
      gradient: gradientFor(`s${p.id}`),
    })),
  );
  add(
    "shorts",
    "🎬",
    data.shorts.map((p) => ({
      key: `v${p.id}`,
      href: `/shorts/${p.id}`,
      title: short(p.title ?? p.name, 70),
      sub: `${t("home.bestof.by", { name: p.name })} · ${t("home.bestof.likes", { n: String(p.likes) })}`,
      badge: p.isNew ? newLabel : undefined,
      thumb: p.thumb,
      gradient: gradientFor(`v${p.id}`),
    })),
  );
  add(
    "photos",
    "📷",
    data.photos.map((p) => ({
      key: `f${p.id}`,
      href: `/photos/${p.id}`,
      title: short(p.title ?? p.name, 70),
      sub: `${t("home.bestof.by", { name: p.name })} · ${t("home.bestof.likes", { n: String(p.likes) })}`,
      badge: p.isNew ? newLabel : undefined,
      thumb: p.thumb,
      gradient: gradientFor(`f${p.id}`),
    })),
  );

  if (slides.length === 0) {
    return (
      <section className="card ch-bestof">
        <h3>
          <span className="ch-boStar" aria-hidden="true">🌟</span> {t("home.bestof.title")}
        </h3>
        <p className="ch-boEmpty">{t("home.bestof.empty")}</p>
      </section>
    );
  }

  return <BestOfRotator slides={slides} title={t("home.bestof.title")} tabsLabel={t("home.bestof.tabs.label")} seconds={bestOfConfig.rotateSeconds} />;
}
