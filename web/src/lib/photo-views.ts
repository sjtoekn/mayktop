// View counts on photos (PHOTO_TODO 6c): the pure rules. No database, so `npm run test:photo-views` can run them.
// Same decision as Social (social-views.ts): ONE running total per photo (`Photo.viewCount`); nothing about WHO looked is
// saved. A view counts only when: the photo was on screen for a moment (VIEW_VISIBLE_MS, in the browser), the viewer is
// logged in, is not the owner, is not a crawler, has not already been counted in the last 24 hours (server memory only),
// and is inside the rate limit (socialLimits.views). A visitor (not logged in) is NOT counted, because counting a visitor
// would need an address or cookie to tell repeats apart, and the site collects nothing about visitors.
import { firstViewInWindow } from "./social-views";

/**
 * True the FIRST time this person is seen on this photo within 24 hours (and remembers it); false for a repeat.
 * It uses the memory of Social views with its own key shape, so photo number 12 and post number 12 never touch each other.
 */
export function firstPhotoViewInWindow(viewerId: string, photoId: number, now: number = Date.now()): boolean {
  return firstViewInWindow(`photo-${viewerId}`, photoId, now);
}
