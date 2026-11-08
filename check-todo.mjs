// Run from the folder that contains TODO.md:  node check-todo.mjs            (main list)
//                                              node check-todo.mjs SOCIAL_TODO.md   (social list)
// Shows progress, the next step to do, and warns if a later step was ticked
// before an earlier one (i.e. not done in order).
import fs from "node:fs";

const file = process.argv[2] || "TODO.md";

if (!fs.existsSync(file)) {
  console.error(`${file} not found here. cd into the folder that contains it first.`);
  process.exit(1);
}

const items = [];
for (const line of fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n")) {
  const m = line.match(/^\[( |x)\]\s+(\d+)\.\s+(.*)$/i);
  if (m) items.push({ done: m[1].toLowerCase() === "x", n: Number(m[2]), text: m[3] });
}

const done = items.filter((i) => i.done).length;
const next = items.find((i) => !i.done);
console.log(`${file} - Done: ${done} / ${items.length}`);

if (!next) {
  console.log("All steps are done.");
  process.exit(0);
}
console.log(`\nNEXT STEP -> ${next.n}. ${next.text}`);

const outOfOrder = items.filter((i) => i.done && i.n > next.n);
if (outOfOrder.length) {
  console.log("\nWARNING: these were ticked before step " + next.n + " was finished:");
  for (const i of outOfOrder) console.log(`  ${i.n}. ${i.text}`);
  process.exitCode = 1;
}
