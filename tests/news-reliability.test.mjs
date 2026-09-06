import test from "node:test";
import assert from "node:assert/strict";
import { getDefaultArchiveYears, getNewsByYears } from "../lib/news.mjs";
import { articleBodyText, evidenceExcerpt, getInvestmentNews } from "../lib/investment-news.mjs";

test("archive years are the current year down to 2025", () => {
  const years = getDefaultArchiveYears();
  assert.equal(years.at(-1), 2025);
  assert.equal(years[0], new Date().getFullYear());
});

test("investment parser ignores Club van 50 text in navigation and footer", () => {
  const text = articleBodyText("<div class='nxs-unistyle-mainmenu'><div>Club van 50</div></div><div id='nxs-content'><aside class='nxs-sidebar'>Club van 50</aside><div class='nxs-article'><h1>Nieuws</h1><p>Welkom bij SEV.</p></div></div><div id='nxs-footer'>Club van 50</div>");
  assert.equal(/club van 50|investering/i.test(text), false);
});

test("investment parser keeps a genuine thank-you mention in article content", () => {
  const text = articleBodyText("<nav>Club van 50</nav><main><article><p>Bedankt aan de Club van 50 voor de investering in onze jeugd.</p></article></main><footer>Club van 50</footer>");
  assert.match(text, /Club van 50/);
  assert.match(evidenceExcerpt(text), /Club van 50/i);
});

test("balanced content extraction keeps evidence after nested divs", () => {
  const text = articleBodyText("<div class='entry-content'><div class='intro'>Voorwoord</div><div><p>Dank aan de Club van 50 voor deze bijdrage.</p></div></div><footer>Club van 50</footer>");
  assert.match(text, /Dank aan de Club van 50/);
});

test("investment news serves bundled snapshot during a cold-source outage", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("source unavailable"); };
  try {
    const items = await getInvestmentNews(10);
    assert.ok(items.some((item) => item.link.includes("onderbouw-sev-sluit-seizoen-af-met-drukbezochte-bbq")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("archive serves bundled RSS snapshot during a cold-source outage", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("source unavailable"); };
  try {
    const items = await getNewsByYears([2026]);
    assert.ok(items.some((item) => item.link.includes("nieuwe-jaargang-sev-buurtresto")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
