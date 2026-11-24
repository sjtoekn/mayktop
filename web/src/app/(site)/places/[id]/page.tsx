import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { parsePlaceId } from "@/lib/place-input";
import { placeTexts, placeTypeNames } from "@/lib/place-text";
import { siteConfig } from "@/config/site";
import { loadPlace, placeWhere } from "@/lib/place-view";
import { getPlaceSeo } from "@/lib/seo-meta";
import { noIndexMetadata, pageMetadata } from "@/lib/seo-text";
import "../../photos/photos.css";
import "../places.css";

// The page header for search engines and share cards (SEO stage 2): the place's name, where it is and its description.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const id = parsePlaceId((await params).id);
  const place = id === null ? null : await getPlaceSeo(id);
  if (id === null || !place) return { title: placeTexts.detailTitle, ...noIndexMetadata };
  const where = placeWhere(place);
  return pageMetadata({
    path: `/places/${id}`,
    title: place.city && !place.name.includes(place.city) ? `${place.name}, ${place.city}` : place.name,
    siteName: siteConfig.name,
    description: place.description || `${placeTypeNames[place.type]} · ${where}`,
  });
}

// One place (Photos plan, stage 3). Anybody may open a place that may be shown (VISIBLE, not deleted); an invalid, missing, hidden
// or deleted one gets "not found". The placeholder id only lets Next.js prepare the page shell at build time (like /photos/[id]).
// Not yet here: the photos taken at this place (stage 4), edit / report (later).
export function generateStaticParams() {
  return [{ id: "1" }];
}

type Params = Promise<{ id: string }>;

export default function PlacePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <PlaceContent params={params} />
    </Suspense>
  );
}

async function PlaceContent({ params }: { params: Params }) {
  await connection();
  const { id: rawId } = await params;
  const id = parsePlaceId(rawId);
  if (id === null) notFound();
  const place = await loadPlace(id);
  if (!place) notFound();

  const hasMap = place.latitude !== null && place.longitude !== null;
  const mapHref = hasMap
    ? `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=15/${place.latitude}/${place.longitude}`
    : null;

  return (
    <>
      <header className="card pg-head ph-head">
        <div>
          <h1 className="sf-h1">{place.name}</h1>
          <p className="pc-text">
            <span className="pl-badge">{placeTypeNames[place.type]}</span>
            {placeWhere(place)}
          </p>
        </div>
        <div className="ph-headActions">
          <Link href="/places" className="btn btn-secondary">{placeTexts.back}</Link>
        </div>
      </header>

      <section className="card pl-detail">
        {place.description ? <p>{place.description}</p> : null}
        <div className="pl-facts">
          {mapHref ? (
            <a href={mapHref} target="_blank" rel="noopener noreferrer">
              {placeTexts.map} ({place.latitude}, {place.longitude})
            </a>
          ) : null}
          {place.website ? (
            <a href={place.website} target="_blank" rel="noopener noreferrer nofollow ugc">
              {placeTexts.website}: {place.website}
            </a>
          ) : null}
          <span>{placeTexts.addedOn} {place.createdAt.toISOString().slice(0, 10)}</span>
        </div>
      </section>
    </>
  );
}
