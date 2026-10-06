import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { load } from "cheerio";
import { formatTeamNames, formatNewsForDisplay, normalizeNewsSearch, audiencesFor } from "../news-utils.js";
import { createNewsService } from "../lib/news.mjs";
import news from "../lib/news-snapshot.json" with { type: "json" };
import investment from "../lib/investment-news-snapshot.json" with { type: "json" };

const root = new URL("../", import.meta.url);
const legacyTeam = /\bJ\s*O[\s-]*\d{1,2}\b/i;

test("current O names replace legacy variants without changing MO or URLs", () => {
  for (const [input, expected] of [
    ["SEV JO9-1 – MO10-1", "SEV O9-1 – MO10-1"],
    ["JO7–JO19, JO23", "O7–O19, O23"],
    ["De JO-6 en JO 17-1", "De O6 en O17-1"],
    ["jo9 en J O 12 en J/M O6", "O9 en O12 en O6"],
    ["J/MO6 speelt tegen MO6", "O6 speelt tegen MO6"],
    ["O 9 speelt tegen MO9", "O9 speelt tegen MO9"],
    ["Johan, Joost, JO2026 en MO10", "Johan, Joost, JO2026 en MO10"],
    ["JO9: https://www.sev-voetbal.nl/JO9-1?team=JO9", "O9: https://www.sev-voetbal.nl/JO9-1?team=JO9"],
  ]) assert.equal(formatTeamNames(input), expected);
  assert.equal(formatTeamNames(null), "");
  assert.equal(normalizeNewsSearch("JO 9-1"), normalizeNewsSearch("O9-1"));
});

test("news presentation changes text only and preserves original source records", () => {
  const original = Object.freeze({ title: "SEV JO9-1 wint", excerpt: "JO9-1 en MO10 spelen.",
    category: "Team JO9-1", link: "https://www.sev-voetbal.nl/sev-jo9-1-wint",
    image: "https://www.sev-voetbal.nl/images-JO9.jpg", searchText: "Brontekst JO9", contentHash: "verified-hash" });
  const displayed = formatNewsForDisplay(original);
  assert.equal(displayed.title, "SEV O9-1 wint");
  assert.equal(displayed.excerpt, "O9-1 en MO10 spelen.");
  assert.equal(displayed.category, "Team O9-1");
  for (const key of ["link", "image", "searchText", "contentHash"]) assert.equal(displayed[key], original[key]);
  assert.equal(original.title, "SEV JO9-1 wint");
  assert.notEqual(displayed, original);
});

test("both news collections display current team names, including historical and cached records", () => {
  for (const collection of [news, investment]) {
    for (const item of collection.items) {
      const displayed = formatNewsForDisplay(item);
      for (const key of ["title", "excerpt", "category"]) {
        assert.doesNotMatch(displayed[key], legacyTeam, `${item.link}: ${key}`);
        // J/MO is de oude gemengde aanduiding, geen zelfstandig MO-meidenteam.
        const sourceMO = String(item[key] || "").replace(/\bJ\s*\/\s*M\s*O[\s-]*\d{1,2}\b/g, "")
          .match(/\bMO\s*-?\s*\d{1,2}\b/g) || [];
        for (const team of sourceMO) assert.ok(displayed[key].includes(team), `MO must remain: ${team}`);
      }
      assert.equal(displayed.link, item.link);
      assert.equal(displayed.image, item.image);
    }
  }
});

test("old and new names retrieve the same original archive records", async () => {
  const service = createNewsService({ seed: news, fetchImpl: async () => { throw new Error("offline"); } });
  for (const [oldName, newName] of [["JO9", "O9"], ["SEV JO9", "SEV O9"], ["JO 17", "O17"], ["JO-6", "O6"]]) {
    const oldResult = await service.getNewsArchivePage({ search: oldName, perPage: 36, refresh: false });
    const newResult = await service.getNewsArchivePage({ search: newName, perPage: 36, refresh: false });
    assert.ok(newResult.total > 0, `${newName} should find source news`);
    assert.equal(oldResult.total, newResult.total);
    assert.deepEqual(oldResult.items.map((item) => item.link), newResult.items.map((item) => item.link));
  }
});

test("O and MO remain youth; only MO implies an all-girls team", () => {
  for (const title of ["O9-1 wint", "O 12 kampioen", "O-6 speelt", "JO9-1 wint", "MO10-1 kampioen"]) {
    assert.ok(audiencesFor({ title }).includes("jeugd"), title);
  }
  assert.ok(audiencesFor({ title: "MO10-1 kampioen" }).includes("vrouwen"));
  assert.ok(audiencesFor({ title: "MO 12 speelt" }).includes("vrouwen"));
  assert.ok(!audiencesFor({ title: "O9-1 wint" }).includes("vrouwen"));
  assert.ok(!audiencesFor({ title: "JO9-1 wint" }).includes("vrouwen"));
  assert.ok(!audiencesFor({ title: "J/MO6 speelt" }).includes("vrouwen"));
  assert.ok(audiencesFor({ title: "O-6 speelt" }).includes("kleuters"));
});

test("every static club page uses current names and the shared news renderer", async () => {
  const pages = (await readdir(root)).filter((name) => name.endsWith(".html"));
  assert.ok(pages.length >= 10);
  for (const page of pages) {
    const $ = load(await readFile(new URL(page, root), "utf8"));
    $("script, style").remove();
    assert.doesNotMatch($("body").text(), legacyTeam, page);
    assert.doesNotMatch($("body").text(), /JO betekent|Jeugd Onder/, page);
    const source = await readFile(new URL(page, root), "utf8");
    assert.match(source, /site\.js\?v=20261006-o/, page);
  }
  const $ = load(await readFile(new URL("lid-worden.html", root), "utf8"));
  assert.match($("[data-joining-route='jeugd'] summary").text(), /O7–O19/);
  assert.match($("[data-joining-route='jeugd'] [data-joining-description]").text(), /volledige meidenteams[^.]*MO/);
  assert.ok($("#contributie table").text().includes("O8 t/m O12 + MO10"));
  const script = await readFile(new URL("site.js", root), "utf8");
  assert.match(script, /function createNewsCard\(item, index, featureFirst\)\s*\{\s*item = formatNewsForDisplay\(item\)/);
});
