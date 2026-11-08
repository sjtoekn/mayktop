// Drawn pictures used when a profile has no cover photo / a post has no real photo.
// They are plain SVG (no image files needed) and are decorative only.

export function CoverArt() {
  return (
    <svg
      className="pf-coverArt"
      viewBox="0 0 1000 200"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pfCoverSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4f93f5" />
          <stop offset="0.45" stopColor="#a9c9f7" />
          <stop offset="0.75" stopColor="#ffd6a3" />
          <stop offset="1" stopColor="#ff9f55" />
        </linearGradient>
        <radialGradient id="pfCoverSun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff8d6" stopOpacity="1" />
          <stop offset="0.35" stopColor="#ffe29a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffb86b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1000" height="200" fill="url(#pfCoverSky)" />
      <circle cx="430" cy="128" r="110" fill="url(#pfCoverSun)" />
      <circle cx="430" cy="128" r="30" fill="#fff6cf" />
      <path d="M0 150 L90 112 L170 140 L270 98 L370 138 L470 110 L580 144 L690 104 L800 142 L900 118 L1000 140 L1000 200 L0 200Z" fill="#8d9be0" opacity="0.75" />
      <path d="M0 170 L110 138 L210 162 L330 126 L450 164 L570 136 L690 168 L810 140 L920 164 L1000 150 L1000 200 L0 200Z" fill="#5f68c0" opacity="0.9" />
      <ellipse cx="300" cy="176" rx="260" ry="22" fill="#ffffff" opacity="0.55" />
      <ellipse cx="620" cy="182" rx="240" ry="20" fill="#ffffff" opacity="0.6" />
      <path d="M780 200 L800 168 L850 154 L930 146 L1000 150 L1000 200Z" fill="#3b2f4a" />
      <path d="M0 200 L0 184 L140 176 L300 192 L420 200Z" fill="#2a2f66" />
      {/* person standing on the rock with raised arms */}
      <g stroke="#1b2455" strokeLinecap="round" fill="none">
        <path d="M905 148 L903 120" strokeWidth="9" />
        <path d="M903 118 L903 92" strokeWidth="14" />
        <path d="M903 96 L880 64" strokeWidth="6" />
        <path d="M903 96 L930 62" strokeWidth="6" />
        <path d="M903 148 L893 150M905 148 L916 150" strokeWidth="6" />
      </g>
      <circle cx="904" cy="80" r="9" fill="#1b2455" />
    </svg>
  );
}

export function PostArt({ kind }: { kind: "hiker" | "sea" }) {
  if (kind === "sea") {
    return (
      <svg viewBox="0 0 800 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="pfSeaSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6ec6ff" />
            <stop offset="0.6" stopColor="#cdeffd" />
            <stop offset="1" stopColor="#fff1cf" />
          </linearGradient>
          <linearGradient id="pfSeaWater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#22c1c3" />
            <stop offset="1" stopColor="#1478a8" />
          </linearGradient>
        </defs>
        <rect width="800" height="260" fill="url(#pfSeaSky)" />
        <circle cx="620" cy="70" r="34" fill="#fff4c2" />
        <rect y="130" width="800" height="90" fill="url(#pfSeaWater)" />
        <path d="M0 210 C 150 190 300 214 450 200 C 600 186 700 210 800 196 L800 260 L0 260Z" fill="#e9c48d" />
        <path d="M180 214 L184 150" stroke="#6b4a2b" strokeWidth="7" strokeLinecap="round" />
        <path d="M184 152 C 150 140 128 150 116 166 M184 152 C 214 138 240 146 252 162 M184 152 C 176 126 190 112 206 108 M184 152 C 160 128 142 126 128 130" stroke="#2e8b57" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M560 200 L600 170 L640 200Z" fill="#b8793f" />
        <rect x="570" y="200" width="60" height="26" fill="#8a5a2e" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 800 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="pfHikeSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b8fe0" />
          <stop offset="0.5" stopColor="#f7c9a0" />
          <stop offset="1" stopColor="#ffa95a" />
        </linearGradient>
        <radialGradient id="pfHikeSun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset="0.4" stopColor="#ffd98a" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffb061" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="260" fill="url(#pfHikeSky)" />
      <circle cx="560" cy="120" r="120" fill="url(#pfHikeSun)" />
      <circle cx="560" cy="120" r="26" fill="#fffbe0" />
      <path d="M0 150 L110 104 L210 138 L330 90 L450 140 L560 112 L680 146 L800 100 L800 260 L0 260Z" fill="#7d86c9" opacity="0.8" />
      <ellipse cx="200" cy="176" rx="240" ry="24" fill="#ffffff" opacity="0.6" />
      <ellipse cx="560" cy="184" rx="260" ry="26" fill="#ffffff" opacity="0.7" />
      <path d="M0 196 L130 176 L260 200 L400 182 L540 204 L680 186 L800 200 L800 260 L0 260Z" fill="#f4f1f7" opacity="0.9" />
      <path d="M0 260 L0 214 C 70 196 160 190 250 204 C 330 216 380 236 420 260Z" fill="#3b3550" />
      {/* hiker sitting on the rock, seen from behind */}
      <g fill="#1e2a52">
        <rect x="150" y="156" width="26" height="40" rx="9" fill="#3a4a2f" />
        <path d="M168 158 C 186 158 196 172 194 198 L152 200 C 150 176 156 160 168 158Z" />
        <circle cx="176" cy="142" r="12" />
        <path d="M150 198 L206 198 L214 210 L146 210Z" />
      </g>
    </svg>
  );
}
