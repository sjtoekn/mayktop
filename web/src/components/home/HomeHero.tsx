"use client";

// The Home banner: three slides with dots. It turns by itself every 6 seconds, but stops while the mouse or the keyboard
// is on it and when the visitor's device asks for less motion. Optional photo per slide: put it at public/home/hero-1.jpg,
// hero-2.jpg, hero-3.jpg (nothing breaks when a file is missing: the colour background shows instead).
import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/shell/Icon";
import { authClient } from "@/lib/auth-client";

type Slide = {
  eyebrow: string;
  title: [string, string];
  text: string;
  primary: { label: string; href: string; icon: string };
  secondary?: { label: string; href: string; icon: string; guestOnly?: boolean };
};

const SLIDES: Slide[] = [
  {
    eyebrow: "Your world, all in one place",
    title: ["Discover more.", "Share what matters."],
    text: "Ideas, conversations, stories and places — all in one community.",
    primary: { label: "Explore", href: "/explore", icon: "compass" },
    secondary: { label: "Join Falvenco", href: "/signup", icon: "users", guestOnly: true },
  },
  {
    eyebrow: "Ask, answer, learn",
    title: ["Ask. Answer.", "Learn together."],
    text: "Get real answers from people who know the subject.",
    primary: { label: "Browse Community", href: "/community", icon: "users" },
    secondary: { label: "Ask a question", href: "/submit", icon: "pencil" },
  },
  {
    eyebrow: "See it, share it",
    title: ["Show your world.", "Photos, shorts, places."],
    text: "Share what you see. Find what others share.",
    primary: { label: "Photos", href: "/photos", icon: "grid" },
    secondary: { label: "Shorts", href: "/shorts", icon: "play" },
  },
];

// The glass tiles on the right of the banner (a quick way into each part of the site).
const TILES: { label: string; href: string; icon: string; cls: string }[] = [
  { label: "Community", href: "/community", icon: "users", cls: "hh-t-community" },
  { label: "Social", href: "/social", icon: "message-circle", cls: "hh-t-social" },
  { label: "News", href: "/news", icon: "newspaper", cls: "hh-t-news" },
  { label: "Shorts", href: "/shorts", icon: "play", cls: "hh-t-shorts" },
  { label: "Photos", href: "/photos", icon: "image", cls: "hh-t-photos" },
  { label: "Places", href: "/places", icon: "mappin", cls: "hh-t-places" },
];

export default function HomeHero() {
  const { data: session } = authClient.useSession();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 6000);
    return () => window.clearInterval(timer);
  }, [paused]);

  const slide = SLIDES[index];
  const secondary = slide.secondary && !(slide.secondary.guestOnly && session) ? slide.secondary : null;

  return (
    <section
      className={`hh-hero hh-slide${index + 1}`}
      aria-roledescription="carousel"
      aria-label="Falvenco highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <nav className="hh-tiles" aria-label="Quick links">
        {TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} className={`hh-tile ${tile.cls}`}>
            <span className="hh-tileIcon" aria-hidden="true">
              <Icon name={tile.icon} size={24} />
            </span>
            <span className="hh-tileLabel">{tile.label}</span>
          </Link>
        ))}
      </nav>
      <div className="hh-text" aria-live="polite">
        <span className="hh-eyebrow">
          <Icon name="flame" size={14} /> {slide.eyebrow}
        </span>
        <h1>
          {slide.title[0]}
          <br />
          <span className="hh-hl">{slide.title[1]}</span>
        </h1>
        <p>{slide.text}</p>
        <div className="hh-actions">
          <Link href={slide.primary.href} className="hh-btn hh-btnPrimary">
            <Icon name={slide.primary.icon} size={18} /> {slide.primary.label}
          </Link>
          {secondary ? (
            <Link href={secondary.href} className="hh-btn hh-btnAccent">
              <Icon name={secondary.icon} size={18} /> {secondary.label}
            </Link>
          ) : null}
        </div>
      </div>
      <div className="hh-dots" role="tablist" aria-label="Choose a highlight">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Highlight ${i + 1}`}
            className={`hh-dot${i === index ? " is-on" : ""}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  );
}
