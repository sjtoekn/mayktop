import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { placeTypes } from "@/config/site";
import { parsePlaceBefore, parsePlaceQuery, parsePlaceTypeParam } from "@/lib/place-input";
import { placeTexts, placeTypeNames } from "@/lib/place-text";
import { loadPlacePage, placeWhere } from "@/lib/place-view";
import "../photos/photos.css";
import "./places.css";

export const metadata: Metadata = {
  title: placeTexts.listTitle,
};

// /places (Photos plan, stage 3): the directory of real places, newest first, with a search box and a type filter. Anybody (also a
// visitor) may look; a login is needed only to add a place. Reads the database, so it runs per request: connection() and the data
// sit INSIDE <Suspense>, the same way /photos does it. The search is a plain GET form (no JavaScript needed).
type Search = Promise<{ before?: string | string[]; q?: string | string[]; type?: string | string[] }>;

export default function PlacesPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <PlacesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PlacesContent({ searchParams }: { searchParams: Search }) {
  await connection();
  const raw = await searchParams;
  const before = parsePlaceBefore(raw.before);
  const q = parsePlaceQuery(raw.q);
  const type = parsePlaceTypeParam(raw.type);
  const page = await loadPlacePage(before, q, type);

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (type) params.set("type", type);
  const base = params.toString() ? `/places?${params.toString()}` : "/places";
  const moreHref = (id: number) => `${base}${params.toString() ? "&" : "?"}before=${id}`;

  return (
    <>
      <header className="card pg-head ph-head">
        <div>
          <h1 className="sf-h1">{placeTexts.listTitle}</h1>
          <p className="pc-text">{placeTexts.listSub}</p>
        </div>
        <div className="ph-headActions">
          <Link href="/places/new" className="btn btn-primary">{placeTexts.add}</Link>
        </div>
      </header>

      <form action="/places" method="get" className="card pg-head pl-search">
        <input type="search" name="q" defaultValue={q} maxLength={80} placeholder={placeTexts.searchPlaceholder} className="pc-field" aria-label={placeTexts.searchPlaceholder} />
        <select name="type" defaultValue={type ?? ""} className="pc-field" aria-label={placeTexts.typeLabel}>
          <option value="">{placeTexts.allTypes}</option>
          {placeTypes.map((key) => (
            <option key={key} value={key}>{placeTypeNames[key]}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-secondary">{placeTexts.search}</button>
      </form>

      {page.items.length === 0 ? (
        <section className="card pg-empty">
          <p>{placeTexts.empty}</p>
        </section>
      ) : (
        <>
          <ul className="pl-list">
            {page.items.map((place) => (
              <li key={place.id} className="card pl-item">
                <Link href={`/places/${place.id}`} prefetch={false}>
                  <b className="pl-name">{place.name}</b>
                  <span className="pl-meta">
                    <span className="pl-badge">{placeTypeNames[place.type]}</span>
                    {placeWhere(place)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <nav className="ph-more">
            {before !== null ? <Link href={base} className="btn btn-secondary">{placeTexts.newest}</Link> : null}
            {page.next !== null ? <Link href={moreHref(page.next)} className="btn btn-secondary">{placeTexts.more}</Link> : null}
          </nav>
        </>
      )}
    </>
  );
}
