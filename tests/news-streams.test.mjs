import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { newsKind, selectNewsKind, dedupeNews } from "../news-utils.js";
import { createNewsService, parseFeed } from "../lib/news.mjs";
import snapshot from "../lib/news-snapshot.json" with { type: "json" };

const offline = async () => { throw new Error("source unavailable"); };
const article = (slug, category = "Club nieuws", date = "2026-10-01T12:00:00Z") => ({
  title: "SEV O9 wint", link: `https://www.sev-voetbal.nl/${slug}`, category,
  categories: [category], date, excerpt: "Verslag van de jeugdwedstrijd.", contentHash: "same-full-body"
});

test("source categories, not sporting titles or URL slugs, determine the stream", () => {
  assert.equal(newsKind(article("wedstrijdverslag")), "news");
  for (const category of ["Wedstrijdverslagen", "Wedstrijdverslag", "WEDSTRIJD-VERSLAGEN"]) {
    assert.equal(newsKind(article("clubnieuws", category)), "reports");
  }
  assert.equal(newsKind({ ...article("jeugd"), categories: ["Jeugd", "Wedstrijdverslagen"] }), "reports");
  const feed = `<rss><channel><item><title>SEV O9 wint</title><link>https://www.sev-voetbal.nl/o9</link><category>Jeugd</category><category>Wedstrijdverslagen</category></item></channel></rss>`;
  assert.equal(newsKind(parseFeed(feed)[0]), "reports");
});

test("identical news and match reports remain separate publications; same-stream duplicates merge", () => {
  const news = article("win");
  const report = article("win-2", "Wedstrijdverslagen");
  assert.equal(dedupeNews([news, report]).length, 2);
  assert.equal(dedupeNews([news, article("win-3")]).length, 1);
  const recovered = dedupeNews([{ ...news, duplicateLinks: [report.link] }, report]);
  assert.equal(recovered.length, 2);
  assert.deepEqual(selectNewsKind(recovered)[0].duplicateLinks, []);
  const reverse = dedupeNews([{ ...report, duplicateLinks: [news.link] }, news]);
  assert.equal(reverse.length, 2);
});

test("homepage selects club news before applying its article limit", async () => {
  const items = Array.from({ length: 8 }, (_, index) => ({
    ...article(`article-${index}`, index < 4 ? "Wedstrijdverslagen" : "Club nieuws"),
    title: `Artikel ${index}`, date: `2026-10-${String(8 - index).padStart(2, "0")}T12:00:00Z`
  }));
  const service = createNewsService({ seed: { ...snapshot, items }, fetchImpl: offline });
  const latest = await service.getLatestNews(4, { refresh: false });
  assert.equal(latest.length, 4);
  assert.ok(latest.every((item) => newsKind(item) === "news"));
});

test("archive streams partition the complete reserve before filtering and pagination", async () => {
  const service = createNewsService({ seed: snapshot, fetchImpl: offline });
  const all = await service.getNewsByYears([2026, 2025], { refresh: false });
  const pages = await Promise.all(["news", "reports"].map((kind) =>
    service.getNewsArchivePage({ kind, perPage: 18, refresh: false })));
  assert.equal(pages[0].total + pages[1].total, all.length);
  for (const [index, kind] of ["news", "reports"].entries()) {
    assert.equal(pages[index].items.length, 18);
    assert.ok(pages[index].items.every((item) => newsKind(item) === kind));
    assert.equal(pages[index].total, selectNewsKind(all, kind).length);
    const second = await service.getNewsArchivePage({ kind, page: 2, refresh: false });
    assert.ok(second.items.every((item) => newsKind(item) === kind));
    assert.ok(second.items.every((item) => !pages[index].items.some((first) => first.link === item.link)));
    const filtered = await service.getNewsArchivePage({ kind, years: [2025], audiences: ["jeugd"], search: "SEV", refresh: false });
    assert.ok(filtered.total > 0);
    assert.ok(filtered.items.every((item) => newsKind(item) === kind && item.date.startsWith("2025") && item.audiences.includes("jeugd")));
  }
  assert.ok(pages[0].items.every((item) => !pages[1].items.some((report) => report.link === item.link)));
});

test("the real O9 duplicate appears once in club news and once in reports", async () => {
  const service = createNewsService({ seed: snapshot, fetchImpl: offline });
  for (const kind of ["news", "reports"]) {
    const page = await service.getNewsArchivePage({ kind, search: "SEV O9-1 verdiende kampioen 1e klasse", refresh: false });
    assert.equal(page.total, 1, kind);
    assert.equal(newsKind(page.items[0]), kind);
  }
});

test("cold source outage cannot mix reports back into default club news", async () => {
  const tasks = [];
  const service = createNewsService({ seed: snapshot, fetchImpl: offline, now: () => Date.parse("2030-01-01") });
  const page = await service.getNewsArchivePage({ waitUntil: (task) => tasks.push(task) });
  await Promise.all(tasks);
  assert.ok(page.items.every((item) => newsKind(item) === "news"));
  assert.equal(page.total, selectNewsKind(snapshot.items).length);
  assert.equal((await service.getNewsArchivePage({ kind: "reports", refresh: false })).total, selectNewsKind(snapshot.items, "reports").length);
});

test("page routes, selected tabs, and cache keys keep both overviews distinct", async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const [home, news, reports, client, server, api] = await Promise.all(
    ["index.html", "nieuws.html", "wedstrijdverslagen.html", "site.js", "server.mjs", "api/news.js"].map(read));
  assert.match(home, /href="\/wedstrijdverslagen"/);
  assert.match(news, /data-news-kind="news"/);
  assert.match(news, /href="\/nieuws" aria-current="page"/);
  assert.match(reports, /data-news-kind="reports"/);
  assert.match(reports, /href="\/wedstrijdverslagen" aria-current="page"/);
  assert.match(client, /sev-news-view-v3-\$\{newsType\}/);
  assert.match(client, /sev-news-archive-v3-\$\{newsType\}/);
  assert.match(client, /sev-news-latest-news-v3/);
  assert.match(client, /limit=\$\{limit\}&kind=news/);
  assert.match(server, /\["\/wedstrijdverslagen", "wedstrijdverslagen.html"\]/);
  assert.match(server, /kind: url.searchParams.get\("kind"\)/);
  assert.match(api, /kind: request.query\?\.kind/);
});
