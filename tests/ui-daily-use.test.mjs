import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { load } from "cheerio";
import { createArchiveView, readArchiveView, formatNewsProgress } from "../news-view-state.js";

const root = new URL("../", import.meta.url);
const html = async (name) => load(await readFile(new URL(name, root), "utf8"));

test("homepage prioritizes news on the same page and retains one-click programme and cancellations", async () => {
  const $ = await html("index.html");
  const primary = $(".hero__actions a").first();
  assert.ok(primary.hasClass("button--lime"));
  assert.equal(primary.attr("href"), "#laatste-nieuws");
  assert.equal($(primary.attr("href")).length, 1);
  assert.equal($(".hero__actions a").last().attr("href"), "https://www.sev-voetbal.nl/programma-fw");
  assert.equal($(".daily-grid a[href='https://www.sev-voetbal.nl/afgelastingen']").length, 1);
});

test("visible heroes have matching responsive preloads and small, high-priority local images", async () => {
  for (const file of ["index.html", "lid-worden.html", "de-investering.html"]) {
    const $ = await html(file);
    const picture = $(".hero-picture");
    const image = picture.find("img");
    const mobile = picture.find("source");
    assert.equal(image.attr("fetchpriority"), "high");
    assert.equal(image.attr("loading"), "eager");
    assert.equal(mobile.attr("media"), "(max-width: 720px)");
    for (const [source, maxBytes] of [[image.attr("src"), 200000], [mobile.attr("srcset"), 120000]]) {
      assert.ok((await stat(new URL(source, root))).size < maxBytes, source);
      assert.equal($("link[rel='preload'][as='image']").toArray().filter((entry) => $(entry).attr("href") === source).length, 1);
    }
  }
});

test("Club van 50 hero actions directly open the same forms as the tiles, keeping nine-plus-more", async () => {
  const $ = await html("de-investering.html");
  for (const [index, id] of [[0, "inschrijven-donateur"], [1, "ideeenbus"]]) {
    const action = $(".page-actions a").eq(index);
    assert.equal(action.attr("href"), $(`#${id}`).attr("href"));
    assert.ok(action.attr("href").startsWith("https://forms.cloud.microsoft/"));
    assert.equal(action.attr("target"), "_blank");
    assert.ok(action.text().includes("↗"));
  }
  assert.equal($("[data-investment-news-grid]").attr("data-page-size"), "9");
  assert.ok($("[data-investment-news-grid]").hasClass("news-grid--compact-mobile"));
});

test("archive filters have an accessible toggle, close action and visible progress label", async () => {
  const $ = await html("nieuws.html");
  assert.equal($("[data-news-filter-toggle]").attr("aria-controls"), $("[data-news-filters]").attr("id"));
  assert.equal($("[data-news-filter-done]").length, 1);
  assert.equal($("[data-news-load-label]").length, 1);
  assert.equal($("[data-news-toolbar] [data-news-status]").length, 1);
});

const now = Date.parse("2026-10-06T12:00:00Z");
const items = Array.from({ length: 36 }, (_, index) => ({ title: `Nieuws ${index}`, link: `https://www.sev-voetbal.nl/nieuws-${index}`, date: "2026-10-06T00:00:00Z" }));
const view = createArchiveView({ url: "/nieuws?years=2025", perPage: 18, items, page: 2, total: 143, hasMore: true, scrollY: 3450, filtersOpen: false }, now);

test("returning to an archive entry restores all loaded pages and the exact reading position", () => {
  const restored = readArchiveView(JSON.stringify(view), { url: view.url, perPage: 18, now: now + 1000 });
  assert.equal(restored.items.length, 36);
  assert.equal(restored.page, 2);
  assert.equal(restored.scrollY, 3450);
  assert.equal(restored.hasMore, true);
});

test("archive state rejects another query, outdated state and invalid pagination", () => {
  const options = { url: view.url, perPage: 18, now };
  assert.equal(readArchiveView(view, { ...options, url: "/nieuws" }), null);
  assert.equal(readArchiveView(view, { ...options, now: now + 86400001 }), null);
  assert.equal(readArchiveView({ ...view, page: 100 }, options), null);
  assert.equal(readArchiveView({ ...view, items: [] }, options), null);
  assert.equal(readArchiveView("not json", options), null);
});

test("progress clearly distinguishes visible cards from total available news", () => {
  assert.equal(formatNewsProgress(36, 261), "36 van 261 berichten getoond");
  assert.equal(formatNewsProgress(261, 261), "261 van 261 berichten getoond");
});
