// Turns the browser's "User-Agent" text into something a person recognises, e.g.
// "Chrome · macOS". The names are brand names, so they are not translated. When nothing is
// recognised the page shows the translated "Unknown device" instead.
export function describeDevice(userAgent: string | null | undefined): string | null {
  const ua = userAgent ?? "";
  if (!ua) return null;

  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\/|FxiOS\//.test(ua)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;

  // iPhone / iPad first (their text also contains "Mac OS X"), Android before Linux.
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Linux/.test(ua)
              ? "Linux"
              : null;

  const parts = [browser, os].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}
