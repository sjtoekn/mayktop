patch-social-links  (YouTube plays inside the post + web addresses as links / link cards)

What it does:
 - Every web address (http/https) in a Social post text is now a clickable link (opens in a new tab, rel="noopener noreferrer nofollow ugc").
 - The FIRST address of a post gets a preview under the text:
     * YouTube (watch, youtu.be, shorts, live, embed, music; start time t=1m30s works): a 16:9 player on OUR page. Click to play:
       before the click only the thumbnail is loaded; the player (youtube-nocookie.com) is created by the click and autoplays.
     * any other address: a link card (host + path). Nothing is downloaded by the server.
 - The post form has a "Add a link" button (field + Add / Cancel; Enter adds, does not post) and a live "Preview" under the text,
   also when the person simply pastes the address into the text.
 - NO DATABASE CHANGE. The address stays inside the text, so old posts, edit, moderation, export and purge work unchanged.
 - SocialBody: addresses are cut out first, so https://x.com/@name is one link, not a mention (social-tags.ts MENTION_RE also refuses "/" on the left).

Install (in the project folder, where PROJECT.md is):
 1. Back up. 2. unzip -o patch-social-links.zip   (all files are NEW or REPLACED whole, nothing to apply)
 3. In web/:  npm run test:social-links   npm run test:social-tags   npm run check:i18n   npm run lint   npm run build
 4. Manual test: /social/submit -> paste https://youtu.be/dQw4w9WgXcQ in the text: the player preview shows; post; the card shows the
    video, click = plays in the post. Try a normal site address (link card), "Add a link" with "example.com" (https:// is added),
    and a text with two addresses (only the first gets a preview, both are links).

Decisions (change if you want):
 - Only the first address gets a preview. Other sites show NO title / picture (that needs the server to download pages: SSRF risk).
   If you want it later it needs a safe fetcher + a new column; say so.
 - The thumbnail comes from i.ytimg.com (Google) when the post is shown; the player itself is loaded only after the click.
 - Only YouTube videos are embedded (other video sites become link cards).
 - Check CSP: if you add a Content-Security-Policy later, allow img-src https://i.ytimg.com and frame-src https://www.youtube-nocookie.com.
