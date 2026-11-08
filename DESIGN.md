# Design system

Last updated: 2026-11-07

## Rules
1. **One source of truth:** `web/src/app/globals.css`. No hard-coded colours (#hex) in components or other CSS files. Use tokens (`bg-surface`, `text-muted`, `var(--brand)`).
2. **Light + dark** are both defined for every colour. A new colour must be added to all three places: light, `data-theme="dark"`, and the dark media query.
3. **Typography:** only the six `.type-*` styles.
4. **Buttons:** one `Primary` per screen area. Secondary for normal actions, Ghost for quiet actions, Danger only for destructive actions.
5. **Cards:** `.card` for posts, comments and boxes. Ads use `.card-ad` and always show the `Ad` badge. A picture or video of an ad sits in `.ad-media` (`components/ad-media.css`): a fixed 16:9 box (no layout shift), the whole picture shown, never cropped; a video shows its poster and never autoplays.
6. **Notices:** removal reasons and warnings use `.notice-*` (item 16).
7. **No text inside components:** all words go through `t()` (the translation helper). `/design` is the only exception (internal page, delete before launch).

## Decisions
- Brand colour: blue `#1f5eff` (light) / `#6d95ff` (dark), taken from the original home-page design.
- Shape: cards 16px radius, inputs 12px, buttons and badges fully round.
- Font: Inter, with fallbacks for Sinhala, Arabic, Hindi, Chinese.
- Contrast: text and button colours chosen to meet WCAG AA (4.5:1) in both modes.

## Preview
Run the site and open `/design`.

## Page frame (TODO item 9)
- One frame for every page: `components/shell/Shell.tsx` (header, left sidebar, right column), mounted once in `app/layout.tsx`. Pages only provide their own content.
- Styles: `shell.css` (frame), `content.css` (posts, comments, community header, buttons/pills/fields in the home style), `home.css` (home banner/composer/feed only).
- All colours are tokens; only the banner/hero illustrations use fixed light colours.

## Update 2026-11-07
- Reference look: the "CommunityHub" mockup (blue + warm orange, soft cards, banner, trending thumbnails).
- New token `--accent` (orange; light and dark): logo mark and warm highlights. Name in the logo: "Mayk" in ink + "Top" in `--brand`.
- Dark/Light: `ThemeToggle.tsx` sets `<html data-theme>` and saves it in localStorage ("theme"); a tiny script in `layout.tsx` applies it before paint. With no saved choice the device setting is used.
- CSS note: base `button/input` font rule in `shell.css` uses `:where()` so it never overrides a class font-size.
- New pages reuse `.card`, `.pc-*` and the `pg-head`, `ex-*`, `tp-*` styles in `content.css`.
