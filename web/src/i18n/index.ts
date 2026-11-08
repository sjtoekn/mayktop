// The translation helper. Usage in any component:
//
//   import { t, tn } from "@/i18n";
//   t("topbar.login")                    -> "Log in"
//   t("post.by", { author: "maya" })     -> "by maya"
//   tn("post.comments", 5)               -> "5 comments"
//
// Keys are checked by TypeScript, so a typo in a key is an error, not a blank.

import { defaultLocale, getDir, type Locale } from "./config";
import en, { type MessageKey, type Messages, type PluralKey } from "./messages/en";
import es from "./messages/es";
import fr from "./messages/fr";
import zh from "./messages/zh";
import hi from "./messages/hi";
import ar from "./messages/ar";

export { locales, defaultLocale, localeNames, getDir, isLocale } from "./config";
export type { Locale } from "./config";

const dictionaries: Record<Locale, Messages> = { en, es, fr, zh, hi, ar };

/**
 * Which language is active right now.
 * For now the site is shown in the default language. When we add a language
 * switcher (later step), THIS is the only function that has to change
 * (read the choice from a cookie or the URL).
 */
export function getLocale(): Locale {
  return defaultLocale;
}

type Params = Record<string, string | number>;

function lookup(locale: Locale, key: string): string | undefined {
  const own = dictionaries[locale] as Record<string, string | undefined>;
  const fallback = dictionaries[defaultLocale] as Record<string, string | undefined>;
  return own[key] ?? fallback[key];
}

function fill(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/** Translate one text. Falls back to English, then to the key itself. */
export function t(key: MessageKey, params?: Params, locale: Locale = getLocale()): string {
  return fill(lookup(locale, key) ?? key, params);
}

/** Translate a text that depends on a number ("1 comment" / "5 comments"). */
export function tn(
  base: PluralKey,
  count: number,
  locale: Locale = getLocale(),
): string {
  const form = new Intl.PluralRules(locale).select(count); // zero|one|two|few|many|other
  const text = lookup(locale, `${base}.${form}`) ?? lookup(locale, `${base}.other`) ?? base;
  return fill(text, { n: formatNumber(count, locale) });
}

/** Format a number the way people in that language expect (1,280 / 1 280 / ١٬٢٨٠). */
export function formatNumber(value: number, locale: Locale = getLocale()): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** Short number: 12400 -> "12.4K" (English), localised for other languages. */
export function formatCompact(value: number, locale: Locale = getLocale()): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** "2025-01-15" -> "Jan 2025". Dates are stored in UTC, so we format in UTC. */
export function formatMonthYear(iso: string, locale: Locale = getLocale()): string {
  return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
}

/** "ltr" or "rtl" for the active language (used on the <html> tag). */
export function getDirection(locale: Locale = getLocale()): "ltr" | "rtl" {
  return getDir(locale);
}
