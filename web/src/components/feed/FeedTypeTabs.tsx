import Link from "next/link";
import Icon from "@/components/shell/Icon";

type FeedType = "community" | "social" | "news";

const tabs: { id: FeedType; label: string; href: string; icon: string }[] = [
  { id: "community", label: "Community", href: "/", icon: "users" },
  { id: "social", label: "Social", href: "/social", icon: "message-circle" },
  { id: "news", label: "News", href: "/news", icon: "newspaper" },
];

export default function FeedTypeTabs({ active }: { active: FeedType }) {
  return (
    <nav className="feed-type-tabs" aria-label="Choose feed type">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`feed-type-tab${active === tab.id ? " is-active" : ""}`}
          aria-current={active === tab.id ? "page" : undefined}
        >
          <Icon name={tab.icon} size={18} />
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
