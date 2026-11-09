// Settings of the Shorts feed and player (SHORTS_TODO 21-27). Pure constants, safe for client code.

/** How many shorts one page of the feed holds (the first page and every "load more"). */
export const SHORT_FEED_PAGE_SIZE = 8;

/** The most a caller may ask for in one request (the API ignores bigger numbers). */
export const SHORT_FEED_MAX_PAGE_SIZE = 20;

/** The +/- buttons of the player jump this many seconds (SHORTS_TODO 22). */
export const SHORT_SKIP_SECONDS = 10;

/** When the person is this many shorts from the end of the loaded list, the next page is fetched. */
export const SHORT_PRELOAD_AHEAD = 3;

/** A video this close to 9:16 fills the screen (cropped a little); any other shape is shown whole, centred, with bars. */
export const SHORT_COVER_MIN_RATIO = 0.5; // width / height
export const SHORT_COVER_MAX_RATIO = 0.62;

/** An ad card comes after every Nth short (never first, never last, at least 3 apart: PROJECT.md section 5). 0 = no ads. */
export const SHORT_AD_EVERY = 5;

/** The ad is counted as seen after it has been the card on screen this long (a quick flick past does not count). */
export const SHORT_AD_VIEW_MS = 1000;
