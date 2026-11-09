// What a person types when adding a Place (Photos plan, stage 3). Pure functions: no database, no disk, so a test can run them.
// The browser is never trusted: the server action runs these again.
//  - NAME: required, ONE line (new lines and tabs become spaces, repeated spaces become one), at most placeFields.nameMax.
//  - TYPE: required, a key of placeTypes.
//  - CITY and REGION: optional, one line each. COUNTRY: required, one line.
//  - DESCRIPTION: optional, several lines allowed (3 or more empty lines in a row become 2), at most placeFields.descriptionMax.
//  - LATITUDE / LONGITUDE: both or none, numbers in range, rounded to 5 decimals. Typed by the person, never read from a photo.
//  - WEBSITE: optional, only http or https, no user name / password in the address, must look like a real host name.
//  - dupKey: name + city + country without capitals, spaces and punctuation (so one place cannot be added twice by typing it a
//    little differently). It is saved UNIQUE in the database.
import { placeFields, placeTypes, type PlaceType } from "@/config/site";

export type PlaceValue = {
  name: string;
  type: PlaceType;
  city: string | null;
  region: string | null;
  country: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  dupKey: string;
};

export type PlaceField = "name" | "type" | "city" | "region" | "country" | "description" | "coords" | "website";
export type ParsePlaceResult = { ok: true; value: PlaceValue } | { ok: false; field: PlaceField };

// control characters are exactly what we refuse
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function lengthOf(text: string): number {
  return [...text].length;
}

/** One clean line: NFC, tabs / new lines / repeated spaces become one space, trimmed. null = not text or has control characters. */
export function cleanLine(input: unknown): string | null {
  if (typeof input !== "string") return null;
  if (CONTROL_RE.test(input.replace(/[\t\r\n]/g, " "))) return null;
  return input.normalize("NFC").replace(/\s+/gu, " ").trim();
}

function cleanText(input: unknown): string | null {
  if (typeof input !== "string") return null;
  if (CONTROL_RE.test(input.replace(/[\t\r\n]/g, " "))) return null;
  return input
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Letters, numbers and combining marks only, lower case (Sinhala and Tamil letters need the marks). */
export function dupPart(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, "");
}

export function makeDupKey(name: string, city: string | null, country: string): string {
  return `${dupPart(name)}|${dupPart(city ?? "")}|${dupPart(country)}`;
}

function optionalLine(input: unknown, max: number): { ok: true; value: string | null } | { ok: false } {
  if (input === null || input === undefined || input === "") return { ok: true, value: null };
  const line = cleanLine(input);
  if (line === null || lengthOf(line) > max) return { ok: false };
  return { ok: true, value: line === "" ? null : line };
}

/** A number from text like "7.9570" or "-80,5" (a comma works as the decimal point). null = empty, NaN = not a number. */
function parseCoordinate(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "string") return Number.NaN;
  const text = input.trim().replace(",", ".");
  if (text === "") return null;
  if (!/^[+-]?\d{1,3}(\.\d+)?$/.test(text)) return Number.NaN;
  return Number(text);
}

export function parsePlaceWebsite(input: unknown): { ok: true; value: string | null } | { ok: false } {
  if (input === null || input === undefined || input === "") return { ok: true, value: null };
  if (typeof input !== "string") return { ok: false };
  let text = input.trim();
  if (text === "") return { ok: true, value: null };
  if (lengthOf(text) > placeFields.websiteMax || /\s/.test(text)) return { ok: false };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = `https://${text}`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false };
  if (url.username !== "" || url.password !== "") return { ok: false };
  if (!url.hostname.includes(".") || url.hostname.endsWith(".")) return { ok: false };
  url.hash = "";
  const href = url.toString();
  if (lengthOf(href) > placeFields.websiteMax) return { ok: false };
  return { ok: true, value: href };
}

/** Reads one value of the form by name (FormData and a plain object both work). */
export type PlaceSource = { get(name: string): unknown };

export function parsePlaceInput(source: PlaceSource): ParsePlaceResult {
  const name = cleanLine(source.get("name"));
  if (name === null || name === "" || lengthOf(name) > placeFields.nameMax) return { ok: false, field: "name" };
  if (dupPart(name) === "") return { ok: false, field: "name" }; // only punctuation

  const rawType = source.get("type");
  if (typeof rawType !== "string" || !(placeTypes as readonly string[]).includes(rawType)) return { ok: false, field: "type" };

  const city = optionalLine(source.get("city"), placeFields.cityMax);
  if (!city.ok) return { ok: false, field: "city" };
  const region = optionalLine(source.get("region"), placeFields.regionMax);
  if (!region.ok) return { ok: false, field: "region" };

  const country = cleanLine(source.get("country"));
  if (country === null || country === "" || lengthOf(country) > placeFields.countryMax) return { ok: false, field: "country" };

  let description: string | null = null;
  const rawDescription = source.get("description");
  if (rawDescription !== null && rawDescription !== undefined && rawDescription !== "") {
    const text = cleanText(rawDescription);
    if (text === null || lengthOf(text) > placeFields.descriptionMax) return { ok: false, field: "description" };
    description = text === "" ? null : text;
  }

  const lat = parseCoordinate(source.get("latitude"));
  const lng = parseCoordinate(source.get("longitude"));
  if (Number.isNaN(lat) || Number.isNaN(lng)) return { ok: false, field: "coords" };
  if ((lat === null) !== (lng === null)) return { ok: false, field: "coords" }; // both or none
  if (lat !== null && lng !== null && (lat < -90 || lat > 90 || lng < -180 || lng > 180)) return { ok: false, field: "coords" };
  const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

  const website = parsePlaceWebsite(source.get("website"));
  if (!website.ok) return { ok: false, field: "website" };

  return {
    ok: true,
    value: {
      name,
      type: rawType as PlaceType,
      city: city.value,
      region: region.value,
      country,
      description,
      latitude: lat === null ? null : round5(lat),
      longitude: lng === null ? null : round5(lng),
      website: website.value,
      dupKey: makeDupKey(name, city.value, country),
    },
  };
}

/** The id from an address like /places/12: only plain whole numbers; anything else is null. */
export function parsePlaceId(input: unknown): number | null {
  if (typeof input !== "string" || !/^[1-9]\d{0,8}$/.test(input)) return null;
  return Number(input);
}

/** `?before=<id>` of the list: same rule as the photo list. */
export function parsePlaceBefore(input: unknown): number | null {
  const first = Array.isArray(input) ? input[0] : input;
  return parsePlaceId(first);
}

/** The search words of the list: one clean line of at most 80 characters, or "". */
export function parsePlaceQuery(input: unknown): string {
  const first = Array.isArray(input) ? input[0] : input;
  const line = cleanLine(first);
  if (line === null) return "";
  return [...line].slice(0, 80).join("");
}

export function parsePlaceTypeParam(input: unknown): PlaceType | null {
  const first = Array.isArray(input) ? input[0] : input;
  return typeof first === "string" && (placeTypes as readonly string[]).includes(first) ? (first as PlaceType) : null;
}
