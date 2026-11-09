patch-shorts-feed  (SHORTS_TODO step 4: items 21-22, 24-26, 27 and the page for 30)
===================================================================================
WHAT YOU GET
  /shorts          full-screen vertical feed, newest first (never by likes or views), scroll-snap
  /shorts/<id>     that short plays first, newer ones follow (this is the link "Share" copies)
  Player           only the visible card plays, mute (starts muted), play / pause (tap or Space),
                   -10 / +10 s buttons, progress bar you can drag, time "0:12 / 0:30"
  Keyboard         Down / Up = next / previous, Space = play / pause, M = mute, Left / Right = -/+10 s
  Layout           phone: whole screen. Desktop: a phone-shaped frame in the middle + up/down buttons
  Share            works (phone share sheet, else copies the link)
  More loading     the next 8 are fetched when you are 3 from the end (GET /api/shorts/feed?cursor=...)

NOT IN THIS PATCH (on purpose, see the end)
  Like / Comment / Save buttons are shown but DISABLED ("Coming soon") until step 5.
  Follow button, ads between shorts, share-to-Social (item 20), block / mute, view count.

FILES (all new, nothing of yours is overwritten)
  web/src/app/(site)/shorts/page.tsx
  web/src/app/(site)/shorts/[id]/page.tsx
  web/src/app/(site)/shorts/shorts.css
  web/src/app/api/shorts/feed/route.ts
  web/src/components/shorts/ShortsFeed.tsx
  web/src/config/short-feed-config.ts      (page size, skip seconds, 9:16 "cover" range)
  web/src/config/short-feed-text.ts        (English texts; i18n is item 41)
  web/src/lib/short-card.ts
  web/src/lib/short-feed-rules.ts          (pure rules)
  web/src/lib/short-queries.ts
  web/scripts/test-short-feed.ts

HOW TO APPLY  (inside the project folder, e.g. ~/Downloads/7-mayktop)
  1. unzip -o patch-shorts-feed.zip          (copies the files above into web/)
  2. In web/package.json, inside "scripts", add this line (mind the comma):
       "test:short-feed": "tsx scripts/test-short-feed.ts",
  3. cd web
     npm run test:short-feed                  (no database; must print: test:short-feed OK)
     npm run lint
     npm run build
     npm run dev   -> open http://localhost:3000/shorts
  NO database change, NO migration.

MANUAL CHECK  (upload 2-3 shorts first at /shorts/upload; with only one, scrolling cannot be tested)
  [ ] /shorts shows a video that starts by itself, muted
  [ ] scroll / swipe: the next one plays, the earlier one stops
  [ ] tap = pause (big play button shows), tap again = play
  [ ] M and the speaker button: sound on, and it STAYS on for the next short
  [ ] -10 / +10 and Left / Right keys move the video; dragging the bar jumps; seeking works (Range)
  [ ] Down / Up keys and the two round buttons (desktop) change the short
  [ ] Share: the link opens /shorts/<id> in a private window (PUBLIC and UNLISTED only)
  [ ] a PRIVATE short: /shorts/<id> is "not found" for others, plays for you
  [ ] the back button (top left) returns to the site

THINGS I COULD NOT CHECK (no project dependencies here, so no build was run)
  - `npm run build` and `npm run lint`: I only checked the pure rules (test passes) and the syntax. Please run both and
    send me any error text.
  - The player COVERS the site menu on purpose (position: fixed, like a reels player). If you want the menu kept, change
    `.shorts-stage` in shorts.css (one place).
  - `isSocialAuthorShown` is used the same way as in your media route; I did not see social-visibility.ts.
  - The creator name links to /social/u/<username>, which asks for a login (Social rule).

DECISIONS FOR YOU
  1. Visitors (not logged in) may watch PUBLIC shorts, because your media route already allows it. Social needs a login.
     Say if /shorts should need a login too.
  2. The feed is newest first. Inside one page the same creator is not played twice in a row if somebody else is waiting
     (no short is dropped). No popularity at all. Tell me if you want something different.
  3. Ads between shorts (SHORTS_TODO decision 6, "now"): I need these files to do it properly: web/src/components/AdSlot.tsx,
     AdBox.tsx, src/lib/ad-positions.ts and the AdSlotType enum from schema.prisma. Run:
        bash ~/Downloads/handoff.sh ad
     and send the new zip. It is the next small patch.
