// Adds the checked RSS feeds to the News sources (the same table as /admin/news). Safe to run twice: a feed that is already
// there is left alone (its on/off setting is NOT changed). Nothing is deleted.
// Run in web/:   npx tsx --env-file=.env scripts/add-news-sources.ts
import { prisma } from "../src/lib/prisma";

// Checked with curl on 2026-11-08: HTTP 200, XML, no redirect (Ada Derana: the final address after its 301).
const FEEDS: { name: string; feedUrl: string; siteUrl: string }[] = [
  { name: "BBC News - World", feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml", siteUrl: "https://www.bbc.com/news" },
  { name: "BBC News - Business", feedUrl: "https://feeds.bbci.co.uk/news/business/rss.xml", siteUrl: "https://www.bbc.com/news/business" },
  { name: "BBC News - Technology", feedUrl: "https://feeds.bbci.co.uk/news/technology/rss.xml", siteUrl: "https://www.bbc.com/news/technology" },
  { name: "BBC News - Health", feedUrl: "https://feeds.bbci.co.uk/news/health/rss.xml", siteUrl: "https://www.bbc.com/news/health" },
  { name: "BBC Sport", feedUrl: "https://feeds.bbci.co.uk/sport/rss.xml", siteUrl: "https://www.bbc.com/sport" },
  { name: "Al Jazeera", feedUrl: "https://www.aljazeera.com/xml/rss/all.xml", siteUrl: "https://www.aljazeera.com" },
  { name: "Ada Derana", feedUrl: "https://adaderana.lk/rss.php", siteUrl: "https://adaderana.lk" },
  { name: "EconomyNext", feedUrl: "https://economynext.com/feed/", siteUrl: "https://economynext.com" },
  { name: "Newswire", feedUrl: "https://www.newswire.lk/feed/", siteUrl: "https://www.newswire.lk" },
  { name: "The Island", feedUrl: "https://island.lk/feed/", siteUrl: "https://island.lk" },
  { name: "Lanka Business Online", feedUrl: "https://www.lankabusinessonline.com/feed/", siteUrl: "https://www.lankabusinessonline.com" },
  { name: "Sunday Observer", feedUrl: "https://www.sundayobserver.lk/feed/", siteUrl: "https://www.sundayobserver.lk" },
  { name: "Dinamina", feedUrl: "https://www.dinamina.lk/feed/", siteUrl: "https://www.dinamina.lk" },
];

async function main() {
  let added = 0;
  for (const feed of FEEDS) {
    const existing = await prisma.newsSource.findUnique({ where: { feedUrl: feed.feedUrl }, select: { id: true } });
    if (existing) {
      console.log(`already there: ${feed.name}`);
      continue;
    }
    await prisma.newsSource.create({ data: { name: feed.name, feedUrl: feed.feedUrl, siteUrl: feed.siteUrl, enabled: true } });
    console.log(`added:         ${feed.name}`);
    added++;
  }
  console.log(`\n${added} added. The collector reads up to 8 enabled feeds per run: run it again to reach the rest.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
