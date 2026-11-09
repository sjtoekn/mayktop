// Reads Places from the database for the pages (Photos plan, stage 3). Server only.
//  - A place is shown to everybody when its status is VISIBLE and it is not deleted.
//  - The list is newest first and pages by cursor (`before` = the id of the last place of the previous page), like /photos.
//  - Search: the words must appear in the name, city, region or country; optional type filter.
import { placeFields, placeTypes, type PlaceType } from "@/config/site";
import { prisma } from "@/lib/prisma";
import { ContentStatus } from "../../generated/prisma/client";

export type PlaceRow = {
  id: number;
  name: string;
  type: PlaceType;
  city: string | null;
  region: string | null;
  country: string;
};
export type PlacePage = { items: PlaceRow[]; next: number | null };

export type PlaceDetail = PlaceRow & {
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  createdAt: Date;
};

/** A stored key that is no longer in the list is shown as "other". */
export function placeTypeOf(stored: string): PlaceType {
  return (placeTypes as readonly string[]).includes(stored) ? (stored as PlaceType) : "other";
}

export async function loadPlacePage(before: number | null, query: string, type: PlaceType | null): Promise<PlacePage> {
  const size = placeFields.pageSize;
  const words = query.split(" ").filter((word) => word !== "").slice(0, 5);
  const rows = await prisma.place.findMany({
    where: {
      status: ContentStatus.VISIBLE,
      deletedAt: null,
      ...(type !== null ? { type } : {}),
      ...(before !== null ? { id: { lt: before } } : {}),
      // every word must be found somewhere (name, city, region or country)
      AND: words.map((word) => ({
        OR: [{ name: { contains: word } }, { city: { contains: word } }, { region: { contains: word } }, { country: { contains: word } }],
      })),
    },
    orderBy: { id: "desc" },
    take: size + 1,
    select: { id: true, name: true, type: true, city: true, region: true, country: true },
  });
  const items = rows.slice(0, size).map((row) => ({ ...row, type: placeTypeOf(row.type) }));
  return { items, next: rows.length > size ? items[items.length - 1].id : null };
}

export async function loadPlace(id: number): Promise<PlaceDetail | null> {
  const row = await prisma.place.findFirst({
    where: { id, status: ContentStatus.VISIBLE, deletedAt: null },
    select: {
      id: true,
      name: true,
      type: true,
      city: true,
      region: true,
      country: true,
      description: true,
      latitude: true,
      longitude: true,
      website: true,
      createdAt: true,
    },
  });
  return row ? { ...row, type: placeTypeOf(row.type) } : null;
}

/** "Anuradhapura, North Central, Sri Lanka" */
export function placeWhere(place: { city: string | null; region: string | null; country: string }): string {
  return [place.city, place.region, place.country].filter((part): part is string => !!part).join(", ");
}
