import test from "node:test";
import assert from "node:assert/strict";
import { NewsIndex } from "../lib/news-index.mjs";
import { createNewsService, collectNewsArchive } from "../lib/news.mjs";
import { createInvestmentNewsService } from "../lib/investment-news.mjs";
import { mergeCompleteSnapshot } from "../lib/news-snapshot-store.mjs";
import news from "../lib/news-snapshot.json" with { type: "json" };
import investment from "../lib/investment-news-snapshot.json" with { type: "json" };
import { selectNewsKind } from "../news-utils.js";

const now = () => Date.parse("2030-01-01T12:00:00Z");
const offline = async () => { throw new Error("source unavailable"); };

test("bundled index is complete and covers both required years", () => {
  assert.equal(news.complete, true);
  assert.ok(news.items.length > 200);
  for (const year of [2026, 2025]) assert.ok(news.items.some((item) => new Date(item.date).getFullYear() === year));
  assert.equal(investment.complete, true);
  assert.ok(investment.items.length >= 20);
});

test("reported real duplicates and the WordPress placeholder are cleaned in the durable index", () => {
  for (const slug of ["sev-1-full-speed-1-5-2", "sev-verliest-eerste-competitiewedstrijd"]) {
    const matches = news.items.filter((item) => item.link.endsWith(`/${slug}`) || item.link.endsWith(`/${slug}-2`));
    assert.equal(selectNewsKind(matches).length, 1, slug);
    assert.ok(selectNewsKind(matches)[0].contentHash);
  }
  assert.equal(news.items.find((item) => item.link.endsWith("sev-jo8-1-bindt-ook-hvv-aan-de-zegekar")).image, "");
});

test("cold source outage immediately preserves the full archive and filters", async () => {
  const tasks = [];
  const service = createNewsService({ seed: news, now, fetchImpl: offline });
  const page = await service.getNewsArchivePage({ archiveYears: [2026, 2025], perPage: 18, waitUntil: (p) => tasks.push(p) });
  assert.equal(page.total, selectNewsKind(news.items).length);
  assert.equal(page.items.length, 18);
  assert.equal(service.getNewsArchiveMeta().refreshing, true);
  await Promise.all(tasks);
  const oldYear = await service.getNewsArchivePage({ archiveYears: [2026, 2025], years: [2025], refresh: false });
  assert.ok(oldYear.total > 0);
  assert.ok(oldYear.items.every((item) => item.date.startsWith("2025")));
  assert.equal(service.getNewsArchiveMeta().sourceUpdatedAt, news.verifiedAt);
  assert.equal(service.getNewsArchiveMeta().stale, true);
});

test("the real police article is returned by the G filter", async () => {
  const service = createNewsService({ seed: news, fetchImpl: offline });
  const result = await service.getNewsArchivePage({ audiences: ["g"], perPage: 36, refresh: false });
  assert.ok(result.items.some((item) => item.link.endsWith("politie-op-bezoek-bij-sev-voor-jaarlijks-voetbalduel-tegen-g-teams")));
});

test("absent URL filters passed as null show the full archive", async () => {
  const service = createNewsService({ seed: news, fetchImpl: offline });
  const result = await service.getNewsArchivePage({ archiveYears: "2026,2025",
    years: null, audiences: null, search: null, page: "1", perPage: "18", refresh: false });
  assert.equal(result.total, selectNewsKind(news.items).length);
  assert.equal(result.items.length, 18);
});

test("Club van 50 outage retains body-only thanks and all twenty articles", async () => {
  const tasks = [];
  const service = createInvestmentNewsService({ seed: investment, now, fetchImpl: offline });
  const items = await service.getInvestmentNews(100, { waitUntil: (p) => tasks.push(p) });
  assert.equal(items.length, investment.items.length);
  assert.ok(items.some((item) => item.link.endsWith("onderbouw-sev-sluit-seizoen-af-met-drukbezochte-bbq")));
  assert.ok(items.some((item) => /polo/.test(item.title)));
  await Promise.all(tasks);
  assert.equal((await service.getInvestmentNews(100, { refresh: false })).length, items.length);
});

test("partial refresh may add items but cannot shrink the index or advance the verification date", async () => {
  const index = new NewsIndex(news, { now });
  const added = { ...news.items[0], title: "Nieuw uniek bericht", link: "https://www.sev-voetbal.nl/nieuw-uniek-bericht", date: "2029-12-31T12:00:00Z", contentHash: undefined, duplicateLinks: [] };
  await index.refresh(async () => ({ items: [added], complete: false, verifiedAt: "2029-12-31T12:00:00Z" }));
  assert.equal(index.items.length, news.items.length + 1);
  assert.equal(index.meta().sourceUpdatedAt, news.verifiedAt);
  assert.equal(index.meta().stale, true);
});

test("slow background refresh never blocks rendering and concurrent readers share one refresh", async () => {
  const index = new NewsIndex(news, { now });
  let finish;
  let calls = 0;
  const deferred = new Promise((resolve) => { finish = resolve; });
  const loader = () => { calls++; return deferred; };
  const tasks = [];
  const first = await index.serve(loader, { waitUntil: (p) => tasks.push(p) });
  await index.serve(loader, { waitUntil: (p) => tasks.push(p) });
  assert.equal(first.length, news.items.length);
  assert.equal(calls, 1);
  const added = { ...news.items[0], title: "Automatisch toegevoegd nieuw bronbericht",
    link: "https://www.sev-voetbal.nl/automatisch-nieuw-bronbericht", date: "2029-12-31T12:00:00Z",
    contentHash: undefined, duplicateLinks: [] };
  finish({ items: [...news.items, added], complete: true, verifiedAt: new Date(now()).toISOString() });
  await Promise.all(tasks);
  assert.equal(index.meta().stale, false);
  assert.equal(index.items.length, news.items.length + 1);
  assert.equal((await index.serve(loader))[0].link, added.link);
  assert.equal(calls, 1);
});

test("empty refresh and partial durable save leave the previous complete collection intact", async () => {
  const index = new NewsIndex(news, { now });
  await index.refresh(async () => ({ items: [], complete: true }));
  assert.equal(index.items.length, news.items.length);
  assert.throws(() => mergeCompleteSnapshot(news, { items: news.items.slice(0, 2), complete: false }), /Onvolledige/);
  const merged = mergeCompleteSnapshot(news, { ...news, items: news.items.slice(0, 2) });
  assert.equal(merged.items.length, news.items.length);
});

test("a missing RSS page is marked incomplete even when a later page reaches the year boundary", async () => {
  const xml = (date) => `<rss><channel><item><title>Nieuws ${date}</title><link>https://www.sev-voetbal.nl/nieuws-${date}</link><pubDate>${date}</pubDate><description>Nieuws</description></item></channel></rss>`;
  const result = await collectNewsArchive({ years: [2026, 2025], fetchImpl: async (url) => {
    const page = Number(new URL(url).searchParams.get("paged") || 1);
    if (page === 2) throw new Error("timeout");
    return new Response(xml(page === 1 ? "2026-01-01" : "2024-01-01"));
  } });
  assert.equal(result.complete, false);
  assert.equal(result.items.length, 1);
});
