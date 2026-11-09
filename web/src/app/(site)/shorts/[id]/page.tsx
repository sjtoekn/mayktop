import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ShortsFeed from "@/components/shorts/ShortsFeed";
import { SHORTS_ROUTE } from "@/config/short-config";
import { shortFeedText } from "@/config/short-feed-text";
import { getShortForViewer, getShortsFeed } from "@/lib/short-queries";
import { shortAdProps } from "@/lib/short-ad-props";
import { getSessionUser } from "@/lib/session";
import "../shorts.css";

export const metadata: Metadata = {
  title: shortFeedText.pageTitle,
};

// Same pattern as post/[id] and social/[id]: one placeholder id at build time, the real work runs inside <Suspense>.
export function generateStaticParams() {
  return [{ id: "0" }];
}

// /shorts/<id> (SHORTS_TODO 30, the link people share): that short plays first, the newest shorts follow.
// PUBLIC and UNLISTED: anyone with the link. Private, hidden or still processing: only the owner and admins. Else "not found".
async function OneShort({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id: rawId } = await params;
  const id = /^\d{1,10}$/.test(rawId) ? Number(rawId) : NaN;
  const viewer = await getSessionUser();
  const short = await getShortForViewer(id, viewer);
  if (!short) return notFound();
  const rest = await getShortsFeed(null, undefined, short.id);
  return (
    <ShortsFeed
      initialItems={[short, ...rest.items]}
      initialNext={rest.next}
      text={shortFeedText}
      uploadHref={`${SHORTS_ROUTE}/upload`}
      homeHref={SHORTS_ROUTE}
      {...shortAdProps()}
    />
  );
}

export default function ShortPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="shorts-stage" aria-busy="true" />}>
      <OneShort params={params} />
    </Suspense>
  );
}
