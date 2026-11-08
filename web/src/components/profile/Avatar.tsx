import { initials, type Profile } from "@/data/profiles";

// Round profile picture. Uses the photo when the profile has one,
// otherwise a coloured circle with the person's initials.
export default function Avatar({
  profile,
  label,
  className = "",
}: {
  profile: Profile;
  label: string;
  className?: string;
}) {
  const style = profile.avatarUrl
    ? { backgroundImage: `url(${profile.avatarUrl})` }
    : { background: profile.avatarGradient };
  return (
    <div className={`pf-avatar ${className}`} style={style} role="img" aria-label={label}>
      {profile.avatarUrl ? null : <span aria-hidden="true">{initials(profile.name)}</span>}
    </div>
  );
}

// The blue "verified" tick that sits next to a name or on the photo.
export function VerifiedBadge({ label, size = 28 }: { label: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      className="pf-verified"
    >
      <circle cx="12" cy="12" r="11" fill="#1f5eff" />
      <path d="M7 12.5l3.2 3.2L17 8.8" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
