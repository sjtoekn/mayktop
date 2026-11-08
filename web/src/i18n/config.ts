// Languages the site supports. To add one:
//   1. add its code here and in `localeNames`
//   2. create src/i18n/messages/<code>.ts (copy en.ts and translate)
//   3. register it in src/i18n/index.ts
export const locales = ["en", "zh", "hi", "es", "fr", "ar"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

// Each language is shown in its own name (so people can find it).
export const localeNames: Record<Locale, string> = {
  en: "English",
  zh: "中文",
  hi: "हिन्दी",
  es: "Español",
  fr: "Français",
  ar: "العربية",
};

// Languages written right-to-left.
const rtlLocales: readonly Locale[] = ["ar"];

export function getDir(locale: Locale): "ltr" | "rtl" {
  return rtlLocales.includes(locale) ? "rtl" : "ltr";
}

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
