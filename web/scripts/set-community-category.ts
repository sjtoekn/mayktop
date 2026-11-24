// Sets the topic of a community (SITE_PLAN A2). Run from the web/ folder:
//   npm run community:category -- <slug> <topic>
//   npm run community:category            (shows every community with its topic and the topics you may use)
import { prisma } from "../src/lib/prisma";
import { communityCategories } from "../src/config/site";

async function main() {
  const [slug, topic] = process.argv.slice(2);
  if (!slug) {
    const rows = await prisma.community.findMany({ where: { archivedAt: null }, orderBy: { id: "asc" }, select: { slug: true, category: true } });
    for (const row of rows) console.log(`${row.slug.padEnd(28)} ${row.category}`);
    console.log(`\nTopics: ${communityCategories.join(" | ")}`);
    console.log("Usage: npm run community:category -- <slug> <topic>");
    return;
  }
  if (!(communityCategories as readonly string[]).includes(topic)) {
    console.log(`Unknown topic "${topic ?? ""}". Use one of: ${communityCategories.join(" | ")}`);
    process.exitCode = 1;
    return;
  }
  const done = await prisma.community.updateMany({ where: { slug }, data: { category: topic } });
  if (done.count === 0) {
    console.log(`No community with the address "${slug}".`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK  ${slug} -> ${topic}  (the pages show it within a minute)`);
}

main().finally(() => prisma.$disconnect());
