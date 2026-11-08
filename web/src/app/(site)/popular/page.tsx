import Link from "next/link";
import PostCard from "@/components/PostCard";
import AdSlot, { isFeedAdPosition } from "@/components/AdSlot";
import { t } from "@/i18n";
import { getPopularPosts } from "@/lib/queries";

export default async function PopularPage() {
  // Fair ranking (TODO 37): votes with diminishing returns and age, one account cannot fill the page,
  // and a fixed share of places for new voices. The rules are in src/lib/ranking.ts and PROJECT.md 8e.
  const posts = await getPopularPosts();

  return (
    <>
      <header className="card pg-head">
        <h1 className="sf-h1">{t("popular.title")}</h1>
        <p className="pc-text">{t("popular.sub")}</p>
        <p className="notice notice-info">
          {t("popular.note")} <Link href="/fairness" className="fa-link">{t("popular.how")}</Link>
        </p>
      </header>
      {posts.map((post, index) => (
        <div key={post.id} className="contents">
          <PostCard post={post} />
          {isFeedAdPosition(index) && <AdSlot variant="feed" />}
        </div>
      ))}
    </>
  );
}
