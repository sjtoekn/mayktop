import Icon from "@/components/shell/Icon";
import { formatMonthYear, t } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import type { BadgeId, Profile } from "@/data/profiles";

// The right-hand column of the profile page: About Me, My Interests, Badges, Join.

export function AboutCard({ profile }: { profile: Profile }) {
  return (
    <section className="card pf-side">
      <h3><span className="pf-ico pf-icoStar"><Icon name="star" size={26} fill="currentColor" /></span> {t("profile.about.title")}</h3>
      <p className="pf-bio">{profile.bio}</p>
      <ul className="pf-meta">
        <li><Icon name="mappin" size={22} /> <span>{profile.location}</span></li>
        <li>
          <Icon name="calendar" size={22} />
          <span>{t("profile.joined", { date: formatMonthYear(profile.joined) })}</span>
        </li>
        {profile.website && (
          <li>
            <Icon name="link" size={22} />
            <a href={`https://${profile.website}`} target="_blank" rel="noopener noreferrer nofollow ugc">
              {profile.website}
            </a>
          </li>
        )}
      </ul>
    </section>
  );
}

export function InterestsCard({ profile }: { profile: Profile }) {
  return (
    <section className="card pf-side">
      <h3><span className="pf-ico pf-icoHeart"><Icon name="heart" size={26} fill="currentColor" /></span> {t("profile.interests.title")}</h3>
      <ul className="pf-chips">
        {profile.interests.map((i) => (
          <li key={i.labelKey} className={`pf-chip pc-a${i.tone}`}>
            {t(i.labelKey)}
          </li>
        ))}
      </ul>
    </section>
  );
}

const BADGES: Record<BadgeId, { icon: string; labelKey: MessageKey; grad: string }> = {
  topCreator: { icon: "star", labelKey: "profile.badge.topCreator", grad: "linear-gradient(160deg,#ffc83d,#f08a00)" },
  activeMember: { icon: "flame", labelKey: "profile.badge.activeMember", grad: "linear-gradient(160deg,#ff8a3d,#e8420c)" },
  communityHelper: { icon: "users", labelKey: "profile.badge.communityHelper", grad: "linear-gradient(160deg,#4d8dff,#1747c9)" },
};

export function BadgesCard({ profile }: { profile: Profile }) {
  return (
    <section className="card pf-side">
      <div className="pf-sideHead">
        <h3><span className="pf-ico pf-icoTrophy"><Icon name="trophy" size={26} /></span> {t("profile.badges.title")}</h3>
      </div>
      <ul className="pf-badges">
        {profile.badges.map((id) => {
          const b = BADGES[id];
          return (
            <li key={id} className="pf-badge">
              <span className="pf-hex" style={{ background: b.grad }}>
                <Icon name={b.icon} size={32} fill={b.icon === "star" ? "currentColor" : "none"} />
              </span>
              <small>{t(b.labelKey)}</small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
