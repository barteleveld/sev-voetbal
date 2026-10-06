import { readFile, writeFile, rename } from "node:fs/promises";
import { collectNewsArchive } from "../lib/news.mjs";
import { collectInvestmentNews } from "../lib/investment-news.mjs";
import { mergeCompleteSnapshot } from "../lib/news-snapshot-store.mjs";

const newsOnly = process.argv.includes("--news-only");
const paths = [new URL("../lib/news-snapshot.json", import.meta.url),
  new URL("../lib/investment-news-snapshot.json", import.meta.url)];
if (newsOnly) paths.pop();
const previous = await Promise.all(paths.map(async (path) => JSON.parse(await readFile(path, "utf8"))));
const candidates = await Promise.all([collectNewsArchive(),
  ...(!newsOnly ? [collectInvestmentNews({ seedItems: previous[1].items })] : [])]);
for (let index = 0; index < candidates.length; index += 1) {
  const candidate = candidates[index];
  console.log(JSON.stringify({ index: index ? "club-van-50" : "nieuws", items: candidate.items.length,
    complete: candidate.complete, pages: candidate.pagesRead, candidates: candidate.candidatesChecked,
    failures: candidate.failures }));
}
// Validate both collections before touching either durable file.
const merged = candidates.map((candidate, index) => mergeCompleteSnapshot(previous[index], candidate));
for (let index = 0; index < paths.length; index += 1) {
  const temporary = new URL(`${paths[index].href}.tmp`);
  await writeFile(temporary, `${JSON.stringify(merged[index], null, 2)}\n`, "utf8");
  await rename(temporary, paths[index]);
}
console.log(`Volledige reserve-index opgeslagen: ${merged[0].items.length} bronartikelen${newsOnly ? "." : `, ${merged[1].items.length} Club van 50-berichten.`}`);
