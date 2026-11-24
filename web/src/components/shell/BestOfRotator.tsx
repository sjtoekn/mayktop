"use client";
// The "Best of the community" box: one slide at a time, the next one after a few seconds. It stops while the mouse is
// over it or a button inside has focus, and it never moves by itself for people who asked their device for less motion.
import Link from "next/link";
import { useEffect, useState } from "react";

export type SlideItem = {
  key: string;
  href: string;
  title: string;
  sub: string;
  badge?: string; // e.g. "New voice"
  thumb?: string; // a picture
  letter?: string; // or a big letter (people)
  emoji?: string; // or an emoji (topics)
  gradient: string;
};

export type Slide = { key: string; emoji: string; label: string; title: string; sub: string; items: SlideItem[] };

export default function BestOfRotator({ slides, title, tabsLabel, seconds }: { slides: Slide[]; title: string; tabsLabel: string; seconds: number }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), seconds * 1000);
    return () => window.clearInterval(timer); // `index` is a dependency, so a click on a tab restarts the count
  }, [paused, slides.length, seconds, index]);

  const slide = slides[index % slides.length];

  return (
    <section
      className="card ch-bestof"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <h3>
        <span className="ch-boStar" aria-hidden="true">🌟</span> {title}
      </h3>
      <div className="ch-boTabs" role="group" aria-label={tabsLabel}>
        {slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className={i === index % slides.length ? "ch-boTab ch-boTabOn" : "ch-boTab"}
            aria-pressed={i === index % slides.length}
            aria-label={s.label}
            title={s.label}
            onClick={() => setIndex(i)}
          >
            <span aria-hidden="true">{s.emoji}</span>
          </button>
        ))}
      </div>
      <div key={slide.key} className="ch-boList">
        <div className="ch-boHead">
          <strong>{slide.title}</strong>
          <small>{slide.sub}</small>
        </div>
        {slide.items.map((item) => (
          <Link key={item.key} href={item.href} className="ch-boItem">
            <div>
              <strong>{item.title}</strong>
              <small>
                {item.sub}
                {item.badge ? <span className="ch-boNew">🌱 {item.badge}</span> : null}
              </small>
            </div>
            <div className="ch-boThumb" style={item.thumb ? undefined : { background: item.gradient }} aria-hidden="true">
              {item.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumb} alt="" loading="lazy" decoding="async" />
              ) : (
                (item.emoji ?? item.letter)
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
