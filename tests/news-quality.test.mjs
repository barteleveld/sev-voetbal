import test from "node:test";
import assert from "node:assert/strict";
import { audiencesFor, dedupeNews, normalizeNewsImage } from "../news-utils.js";
import { verifyContentDuplicates, parseFeed } from "../lib/news.mjs";
import { articleBodyText, extractSearchPage } from "../lib/investment-news.mjs";

const body = "De wedstrijd begon op ingetogen wijze. Vooraf werd een minuut stilte gehouden. Daarna speelde SEV een sportieve en spannende wedstrijd met veel mooie doelpunten.";
const item = (link, overrides = {}) => ({ title: "SEV 1 – Full Speed 1: 5-2", link,
  date: "2026-04-28T08:00:00.000Z", excerpt: body, image: "", ...overrides });

test("G-teams police article and plural variants are correctly classified", () => {
  for (const title of ["Politie op bezoek bij SEV voor jaarlijks voetbalduel tegen G-teams", "G jeugd in het zonnetje", "G-spelers", "SEV G1", "G-toernooien"]) {
    assert.ok(audiencesFor({ title }).includes("g"), title);
  }
  assert.ok(!audiencesFor({ title: "Grote Clubactie levert geld op" }).includes("g"));
});

test("age groups, source categories and multiple audiences work", () => {
  assert.ok(audiencesFor({ title: "JO8-1 wint eerste wedstrijd" }).includes("jeugd"));
  assert.ok(!audiencesFor({ title: "JO8-1 wint eerste wedstrijd" }).includes("senioren"));
  assert.ok(audiencesFor({ title: "Spetterende afsluiting J/M O6" }).includes("kleuters"));
  assert.ok(audiencesFor({ title: "Feest", categories: ["Jeugd", "G-voetbal"] }).includes("g"));
  assert.deepEqual(audiencesFor({ title: "SEV Old Stars Walking Football" }), ["veteranen", "walking"]);
  assert.ok(audiencesFor({ title: "SEV damesvoetbal" }).includes("vrouwen"));
  assert.ok(audiencesFor({ title: "SEV WF eervol 2e bij toernooi Vredenburch" }).includes("walking"));
  assert.ok(audiencesFor({ title: "Veteranen 35+" }).includes("veteranen"));
});

test("generic images and unsafe image protocols fall back to the logo", () => {
  for (const image of ["", "https://www.sev-voetbal.nl/wp-includes/images/media/default.png?x=1", "https://www.sev-voetbal.nl/thumbnail-algemeen.jpg", "javascript:alert(1)"]) {
    assert.equal(normalizeNewsImage(image), "");
  }
  assert.equal(normalizeNewsImage("https://www.sev-voetbal.nl/teamfoto.jpg"), "https://www.sev-voetbal.nl/teamfoto.jpg");
});

test("identical titles or RSS introductions alone never remove an article", () => {
  assert.equal(dedupeNews([item("/verslag"), item("/verslag-2")]).length, 2);
});

test("verified identical full texts are collapsed and keep a usable image", async () => {
  const items = [item("/verslag-2"), item("/verslag", { image: "https://www.sev-voetbal.nl/team.jpg" })];
  const fetchImpl = async (link) => new Response(`<div class='nxs-article-container'>${link.endsWith("-2") ? '<h1>SEV 1 - Full Speed 1: 5-2</h1>' : ''}<p>${body}</p></div>`);
  const result = await verifyContentDuplicates(items, fetchImpl);
  assert.equal(result.length, 1);
  assert.equal(result[0].link, "https://www.sev-voetbal.nl/verslag");
  assert.equal(result[0].image, "https://www.sev-voetbal.nl/team.jpg");
  assert.deepEqual(result[0].duplicateLinks, ["https://www.sev-voetbal.nl/verslag-2"]);
  // The next RSS refresh cannot reintroduce a previously verified duplicate.
  assert.equal(dedupeNews([...result, item("/verslag-2")]).length, 1);
});

test("same introduction but different full stories remain separate", async () => {
  const result = await verifyContentDuplicates([item("/verslag"), item("/verslag-2")], async (link) =>
    new Response(`<article><p>${body} ${link.endsWith("-2") ? "Een andere uitslag." : "Deze wedstrijd eindigde gelijk."}</p></article>`));
  assert.equal(result.length, 2);
});

test("failed full-text verification preserves both articles", async () => {
  const result = await verifyContentDuplicates([item("/verslag"), item("/verslag-2")], async () => { throw new Error("offline"); });
  assert.equal(result.length, 2);
});

test("inline formatting and slightly different RSS intros do not retain a proven duplicate", async () => {
  const result = await verifyContentDuplicates([item("/verslag"), item("/verslag-2", { excerpt: `${body} Extra inleiding.` })],
    async (link) => new Response(`<article><p>${body} In de 14${link.endsWith("-2") ? "e" : "<sup>e</sup>"} minuut werd gescoord.</p></article>`));
  assert.equal(result.length, 1);
});

test("search pagination follows next, not the first previous-pagination link", () => {
  const page = extractSearchPage(`<a href='/bericht'><div class='nxs-archiveentry-row'>Bericht</div></a>
    <a class='pagination previous' href='/?s=investering'>Vorige</a>
    <a class='pagination next' href='/page/3/?s=investering'>Volgende</a>`);
  assert.equal(page.next, "https://www.sev-voetbal.nl/page/3/?s=investering");
  assert.deepEqual(page.links, ["https://www.sev-voetbal.nl/bericht"]);
});

test("Nexus inline HTML scripts cannot break body extraction or add false thanks", () => {
  const html = `<main><nav>Club van 50</nav><div class='nxs-article-container'><script>const popup='<div>Club van 50';</script><div><p>${body}</p></div></div><aside>Club van 50</aside></main>`;
  const result = articleBodyText(html);
  assert.ok(result.includes("De wedstrijd begon"));
  assert.ok(!result.includes("Club van 50"));
});

test("Nexus body-only thanks after nested widgets are retained", () => {
  const html = `<div class='nxs-article-container'><div><p>Een mooie clubdag.</p></div><div><p>Dankzij de bijdrage van De InVESTEring was dit mogelijk.</p></div></div><footer>Extra inhoud</footer>`;
  assert.match(articleBodyText(html), /Dankzij de bijdrage van De InVESTEring/);
});

test("RSS contains all categories and generic media are normalized", () => {
  const xml = `<rss><channel><item><title>Jeugd</title><link>https://www.sev-voetbal.nl/jeugd</link><pubDate>Tue, 06 Oct 2026 08:00:00 GMT</pubDate><category>Clubnieuws</category><category>G-voetbal</category><description><![CDATA[<img src='https://www.sev-voetbal.nl/wp-includes/images/media/default.png'>Dank aan iedereen.]]></description></item></channel></rss>`;
  const [result] = parseFeed(xml);
  assert.deepEqual(result.categories, ["Clubnieuws", "G-voetbal"]);
  assert.equal(result.image, "");
});
