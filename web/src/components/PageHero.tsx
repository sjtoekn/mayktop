import "./PageHero.css";

/**
 * The hero banner of the Social and News pages (same look and size as the Community banner on Home).
 * `parts` = the three words of the title ("Chat", "Connect", "Share"), shown with dots between them. The only <h1> of the page.
 * The illustration is decoration only (aria-hidden). Server component.
 */
export default function PageHero({ variant, parts, sub }: { variant: "social" | "news" | "photos" | "shorts"; parts: [string, string, string]; sub: string }) {
  return (
    <section className={`ph-hero ph-${variant}`}>
      <div className="ph-text">
        <h1>
          {parts[0]} <i>•</i> {parts[1]} <i>•</i> {parts[2]}
        </h1>
        <p>{sub}</p>
      </div>
      <div className="ph-art" aria-hidden="true">
        {variant === "photos" ? (
          <svg viewBox="0 -14 150 124" xmlns="http://www.w3.org/2000/svg">
            <g fill="#ffffff" opacity=".9">
              <path d="M126 -6l2.4 6.2 6.2 2.4-6.2 2.4L126 11l-2.4-6.2-6.2-2.4 6.2-2.4z" />
              <path d="M14 8l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" />
            </g>
            <g transform="rotate(-8 44 70)">
              <rect x="10" y="26" width="64" height="78" rx="8" fill="#ffffff" />
              <rect x="17" y="33" width="50" height="50" rx="5" fill="#9fe0c8" />
              <circle cx="31" cy="47" r="6" fill="#ffd54a" />
              <path d="M17 83l17-23 12 14 9-10 12 19z" fill="#12997a" />
            </g>
            <g transform="rotate(7 104 66)">
              <rect x="76" y="14" width="60" height="76" rx="8" fill="#ffffff" />
              <rect x="83" y="21" width="46" height="48" rx="5" fill="#8fd3ff" />
              <circle cx="116" cy="34" r="6" fill="#fff0a0" />
              <path d="M83 69l14-20 10 12 8-9 14 17z" fill="#0b6e8a" />
            </g>
          </svg>
        ) : variant === "shorts" ? (
          <svg viewBox="0 -14 150 124" xmlns="http://www.w3.org/2000/svg">
            <g fill="#ffffff" opacity=".9">
              <path d="M24 -2l2.4 6.2 6.2 2.4-6.2 2.4L24 15l-2.4-6.2-6.2-2.4 6.2-2.4z" />
              <path d="M132 30l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" />
            </g>
            <rect x="46" y="2" width="58" height="106" rx="14" fill="#e0245e" />
            <rect x="52" y="10" width="46" height="90" rx="9" fill="#ffe4ec" />
            <circle cx="75" cy="55" r="15" fill="#e0245e" />
            <path d="M70 47l14 8-14 8z" fill="#ffffff" />
            <rect x="60" y="82" width="30" height="5" rx="2.5" fill="#e0245e" opacity=".5" />
            <path d="M122 70c-10-6-15-10-15-15 0-4 3-7 6-7 3 0 5 2 9 5 4-3 6-5 9-5 3 0 6 3 6 7 0 5-5 9-15 15z" fill="#ffffff" transform="translate(-2 6) scale(.9)" />
            <circle cx="22" cy="74" r="9" fill="#ffc233" />
            <circle cx="22" cy="74" r="4" fill="#ffffff" />
          </svg>
        ) : variant === "social" ? (
          <svg viewBox="0 -14 150 124" xmlns="http://www.w3.org/2000/svg">
            <g fill="#ffffff" opacity=".9">
              <path d="M70 -6l2.4 6.2 6.2 2.4-6.2 2.4L70 11l-2.4-6.2-6.2-2.4 6.2-2.4z" />
              <path d="M128 12l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" />
            </g>
            <rect x="4" y="34" width="70" height="46" rx="16" fill="#7b4dff" />
            <path d="M22 78l-4 22 22-18z" fill="#7b4dff" />
            <rect x="60" y="14" width="76" height="50" rx="17" fill="#ff5fa2" />
            <path d="M118 62l8 24-26-20z" fill="#ff5fa2" />
            <g fill="#ffffff">
              <circle cx="28" cy="57" r="5" /><circle cx="44" cy="57" r="5" /><circle cx="60" cy="57" r="5" />
            </g>
            <path d="M98 50c-14-9-22-15-22-23 0-6 4-10 9-10 5 0 8 3 13 8 5-5 8-8 13-8 5 0 9 4 9 10 0 8-8 14-22 23z" fill="#ffffff" transform="translate(-1 2) scale(.92)" />
            <rect x="0" y="100" width="150" height="10" fill="#5b3cc4" opacity=".0" />
          </svg>
        ) : (
          <svg viewBox="0 -14 150 124" xmlns="http://www.w3.org/2000/svg">
            <g stroke="#ffb300" strokeWidth="4" strokeLinecap="round">
              <line x1="118" y1="-10" x2="118" y2="-2" /><line x1="95" y1="-4" x2="100" y2="3" /><line x1="141" y1="-4" x2="136" y2="3" />
            </g>
            <circle cx="118" cy="22" r="14" fill="#ffc233" />
            <rect x="8" y="30" width="96" height="78" rx="10" fill="#0b8aa3" />
            <rect x="20" y="42" width="34" height="26" rx="5" fill="#d9f4fa" />
            <g fill="#d9f4fa">
              <rect x="62" y="42" width="30" height="5" rx="2.5" /><rect x="62" y="53" width="30" height="5" rx="2.5" /><rect x="62" y="64" width="30" height="5" rx="2.5" />
              <rect x="20" y="78" width="72" height="5" rx="2.5" /><rect x="20" y="89" width="50" height="5" rx="2.5" />
            </g>
            <rect x="92" y="52" width="46" height="56" rx="10" fill="#ff7a2f" />
            <g fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round">
              <path d="M104 74a14 14 0 0 1 22 0" /><path d="M98 66a24 24 0 0 1 34 0" />
            </g>
            <circle cx="115" cy="84" r="4.5" fill="#ffffff" />
          </svg>
        )}
      </div>
    </section>
  );
}
