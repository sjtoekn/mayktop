import Link from "next/link";
import { notFound } from "next/navigation";
import PostCard from "@/components/PostCard";
import AdSlot, { isFeedAdPosition } from "@/components/AdSlot";
import Icon from "@/components/shell/Icon";
import JoinButton from "@/components/JoinButton";
import { t, tn } from "@/i18n";
import { getCommunities, getCommunity, getPostsByCommunity } from "@/lib/queries";

// Tell Next.js which communities exist so each page can be prepared in advance.
export async function generateStaticParams() {
  const communities = await getCommunities();
  return communities.map((c) => ({ slug: c.slug }));
}

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const community = await getCommunity(slug);
  if (!community) notFound();
  const posts = await getPostsByCommunity(slug);

  return (
    <>
      <section className="pc-hero">
        <div className="pc-hero-top">
          <div>
            <h1>{community.name}</h1>
            <p className="pc-hero-slug">c/{community.slug}</p>
          </div>
          <JoinButton
            slug={community.slug}
            text={{
              join: t("community.join"),
              leave: t("community.leave"),
              error: t("community.error"),
              moderator: t("community.leave.moderator"),
              login: { message: t("auth.required"), link: t("topbar.login") },
            }}
          />
        </div>
        <p className="pc-hero-desc">{community.description}</p>
        <p className="pc-hero-members">{tn("community.members", community.members)}</p>
      </section>

      <section className="card pc-rules">
        <h2>{t("community.rules")}</h2>
        <ol>
          {community.rules.map((r, i) => (
            <li key={r.title} className="pc-rule">
              <span className="pc-rule-n">{i + 1}</span>
              <span><b>{r.title}.</b> {r.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="pc-sectionbar">
        <h2>{t("community.posts")}</h2>
        <Link href={`/submit?c=${community.slug}`} className="pc-btn pc-btn-sm">
          <Icon name="pencil" size={18} /> {t("community.newpost")}
        </Link>
      </div>

      {posts.length === 0 && <p className="card pc-empty">{t("community.empty")}</p>}

      {posts.map((post, index) => (
        <div key={post.id} className="contents">
          <PostCard post={post} />
          {isFeedAdPosition(index) && <AdSlot variant="feed" />}
        </div>
      ))}
    </>
  );
}
