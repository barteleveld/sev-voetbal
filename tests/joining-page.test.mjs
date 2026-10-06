import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { load } from "cheerio";

const root = new URL("../", import.meta.url);
const html = async () => load(await readFile(new URL("lid-worden.html", root), "utf8"));
const routeKeys = ["peuters", "kleuters", "jeugd", "senioren", "vrouwen", "g", "walking", "zaal"];
const officialSources = new Set([
  "https://www.sev-voetbal.nl/peuters",
  "https://www.sev-voetbal.nl/sev-kleutervoetbal",
  "https://www.sev-voetbal.nl/jeugdvoetbal-sev",
  "https://www.sev-voetbal.nl/lid-worden",
  "https://www.sev-voetbal.nl/g-jeugd",
  "https://www.sev-voetbal.nl/vereniging/bestuur/",
  "https://www.sev-voetbal.nl/contactpersonen",
  "https://www.sev-voetbal.nl/vereniging/zaalvoetbal",
  "https://www.sev-voetbal.nl/walking-football",
]);

test("joining page has unique IDs and every internal link resolves", async () => {
  const $ = await html();
  const ids = $("[id]").toArray().map((element) => $(element).attr("id"));
  assert.equal(new Set(ids).size, ids.length, "IDs must be unique");

  $("a[href^='#']").each((_, element) => {
    const target = $(element).attr("href").slice(1);
    assert.ok(target, "internal links must name a target");
    assert.equal($(`[id='${target}']`).length, 1, `missing or duplicate anchor target #${target}`);
  });
});

test("all eight joining routes are native, readable details with direct trial links", async () => {
  const $ = await html();
  const routes = $("details[data-joining-route]");
  assert.deepEqual(routes.toArray().map((element) => $(element).attr("data-joining-route")), routeKeys);
  for (const route of routes.toArray()) {
    const item = $(route);
    assert.equal(item.attr("name"), "voetbalvorm", "native details should form one exclusive disclosure group");
    assert.ok(item.find("summary").length, `${item.attr("data-joining-route")} needs a summary`);
    assert.ok(item.attr("data-joining-label"), "route needs its accessible/display label");
    assert.ok(item.find("[data-joining-description]").length, "route needs a description");
    assert.ok(item.find("[data-joining-contact]").length, "route needs contact links");
    assert.equal(item.find("[hidden]").length, 0, "details content must remain readable without JavaScript");
    const choice = item.find("[data-join-choice]");
    assert.equal(choice.attr("data-join-choice"), item.attr("data-joining-route"));
    assert.equal(choice.attr("href"), "#proeftraining");
  }
});

test("trial panel exposes accessible output and signup sources keep their distinct purposes", async () => {
  const $ = await html();
  assert.equal($("#proeftraining [data-trial-title]").length, 1);
  assert.equal($("#proeftraining [data-trial-copy]").length, 1);
  assert.equal($("#proeftraining [data-trial-contact]").length, 1);
  assert.equal($("#proeftraining [data-trial-placeholder]").length, 1);
  const sectionOrder = $("main section").toArray().map((element) => $(element).attr("id"));
  assert.ok(sectionOrder.indexOf("voetbalvormen") >= 0, "joining routes section must exist");
  assert.ok(sectionOrder.indexOf("proeftraining") > sectionOrder.indexOf("voetbalvormen"), "routes must precede trial section");
  assert.ok(sectionOrder.indexOf("aanmelden") > sectionOrder.indexOf("proeftraining"), "trial section must precede registration");

  const trialMail = $("a[href='mailto:sevleden@sev-voetbal.nl']");
  const adminMail = $("a[href='mailto:ledenadm.sev@gmail.com']");
  assert.ok(trialMail.length, "sevleden mailbox is for trial-training enquiries");
  assert.ok(adminMail.length, "ledenadm mailbox is for registration administration");
  assert.notEqual(trialMail.closest("section").attr("id"), adminMail.closest("section").attr("id"));

  const register = $("a[href='https://www.sev-voetbal.nl/club_aanmelden/']");
  assert.equal(register.length, 1);
  assert.equal(register.attr("target"), "_blank");
  assert.equal(register.attr("rel"), "noreferrer");
});

test("each football route keeps its verified point of contact and age guidance", async () => {
  const $ = await html();
  const route = (key) => $(`[data-joining-route='${key}']`);
  const contactHrefs = (key) => route(key).find("[data-joining-contact] a").toArray().map((element) => $(element).attr("href"));

  assert.deepEqual(contactHrefs("peuters"), ["mailto:peuters@sev-voetbal.nl"]);
  assert.deepEqual(contactHrefs("kleuters"), ["tel:+31624694025"]);
  assert.deepEqual(contactHrefs("jeugd"), ["mailto:sevleden@sev-voetbal.nl"]);
  assert.deepEqual(contactHrefs("senioren"), ["mailto:secretarissev@gmail.com", "tel:+31653366462"]);
  assert.deepEqual(contactHrefs("vrouwen"), ["mailto:secretarissev@gmail.com", "tel:+31653366462"]);
  assert.deepEqual(contactHrefs("g"), ["mailto:kirstenwijers@live.nl", "tel:+31619949944"]);
  assert.deepEqual(contactHrefs("walking"), ["mailto:allstars.sev@hotmail.com", "tel:+31640000505"]);
  assert.deepEqual(contactHrefs("zaal"), ["mailto:jeroen_ruyter@msn.com", "tel:+31642488834"]);

  assert.match(route("peuters").text(), /2\s+en\s+3\s+jaar/);
  assert.match(route("kleuters").text(), /4\s+en\s+5\s+jaar/);
  assert.match(route("walking").text(), /60\+/);
  const routesText = $("details[data-joining-route]").toArray().map((element) => $(element).text()).join(" ");
  assert.doesNotMatch(routesText, /\b20(?:19|20|21|22|23|24|25|26|27)\b/, "route copy should not hard-code season-specific birth years");
});

test("contribution table shows the 2026–2027 published categories and verified source links", async () => {
  const $ = await html();
  const table = $("#contributie table");
  assert.equal(table.find("caption").text().trim(), "Jaarcontributie 2026–2027");
  const expected = new Map([
    ["Peutervoetbal", "€ 140,-"], ["O7", "€ 165,-"], ["O8 t/m O12 + MO10", "€ 225,-"],
    ["O13 t/m O15", "€ 255,-"], ["O16 t/m O19", "€ 300,-"], ["O23", "€ 375,-"],
    ["Senioren", "€ 375,-"], ["Senioren duolid", "€ 215,-"], ["Dames (halve competitie) 7x7", "€ 130,-"],
    ["Walking Football", "€ 150,-"], ["G senioren", "€ 240,-"], ["G senioren-training", "€ 165,-"],
    ["G junioren", "€ 165,-"], ["Trainingslid", "€ 140,-"], ["Niet-spelend (sponsor) lid", "€ 120,-"],
  ]);
  const actual = new Map(table.find("tbody tr").toArray().map((row) => {
    const cells = $(row).find("th, td");
    return [cells.eq(0).text().trim(), cells.eq(1).text().trim()];
  }));
  assert.deepEqual(actual, expected);
  assert.equal($("time[datetime='2026-10-06']").length, 1, "page needs a dated source-check timestamp");

  const costs = $("#contributie");
  assert.equal(costs.find("a[href='mailto:penningmeestersev@gmail.com']").length, 1, "payment questions should go to the treasurer");
  assert.match(costs.text(), /binnen\s+30\s+dagen/);
  assert.match(costs.text(), /€\s*15/);
  assert.match(costs.text(), /100%\s+voor\s+jeugdleden\s+jonger\s+dan\s+18/);
  assert.match(costs.text(), /50%\s+voor\s+senioren/);
  assert.match(costs.text(), /maximaal\s+50%/);
  assert.match(costs.text(), /kleuters\s+en\s+zaalvoetbal[^.]*geen\s+afzonderlijk\s+bedrag/i);
  assert.ok(!actual.has("Kleuters") && !actual.has("Kleutervoetbal"), "do not invent a kleuter tariff");
  assert.ok(!actual.has("Zaal") && !actual.has("Zaalvoetbal"), "do not invent a zaal tariff");

  $("a[data-source-link]").each((_, element) => {
    const href = $(element).attr("href");
    assert.ok(officialSources.has(href), `source must be a verified official SEV URL: ${href}`);
  });
});

test("joining hero keeps its high-priority responsive image treatment", async () => {
  const $ = await html();
  const picture = $(".hero-picture");
  const image = picture.find("img");
  const mobile = picture.find("source");
  assert.ok(picture.length);
  assert.equal(image.attr("fetchpriority"), "high");
  assert.equal(image.attr("loading"), "eager");
  assert.equal(mobile.attr("media"), "(max-width: 720px)");
  for (const source of [image.attr("src"), mobile.attr("srcset")]) {
    assert.ok(source);
    assert.ok((await stat(new URL(source, root))).size < 200000, `${source} should remain optimized`);
    assert.equal($("link[rel='preload'][as='image']").toArray().filter((element) => $(element).attr("href") === source).length, 1);
  }
});
