import snapshot from "./investment-news-snapshot.json" with { type: "json" };
import { NewsIndex } from "./news-index.mjs";
import { dedupeNews } from "../news-utils.js";
import { extractArticleText } from "./article-text.mjs";
import { load } from "cheerio";

const SOURCE_URL = "https://www.sev-voetbal.nl/?s=investering";
const SEARCH_QUERIES = ["investering", "club van 50"];
const SEV_ORIGIN = "https://www.sev-voetbal.nl";

function decodeEntities(value = "") {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
    rsquo: "’",
    lsquo: "‘",
    rdquo: "”",
    ldquo: "“",
    hellip: "…",
    ndash: "–",
    mdash: "—"
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const isHex = entity[1].toLowerCase() === "x";
      const parsed = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isInteger(parsed) && parsed >= 0 && parsed <= 0x10ffff ? String.fromCodePoint(parsed) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function cleanText(html = "") {
  return decodeEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function shortenBrandName(value = "") {
  return value
    .replace(/Club van 50\s*[‘'“"]?De InVESTEring[’'”"]?/gi, "Club van 50")
    .replace(/[‘'“"]?\bde\s+InVESTEring\b[’'”"]?/gi, "Club van 50")
    .replace(/[‘'“"]?\bInVESTEring\b[’'”"]?/gi, "Club van 50");
}

function normalizeNewsTitle(value = "") {
  const withoutSiteName = value.replace(/\s*\|\s*SEV\s*$/i, "").trim();

  if (/breidt naam uit met Club van 50/i.test(withoutSiteName)) {
    return 'Club van 50 "De InVESTEring" krijgt een herkenbare naam';
  }

  const fullName = 'Club van 50 "De InVESTEring"';
  const normalizedFullName = withoutSiteName.replace(
    /Club van 50\s*[‘'“"]?De InVESTEring[’'”"]?/gi,
    fullName
  );
  return normalizedFullName.includes(fullName)
    ? normalizedFullName
    : shortenBrandName(normalizedFullName).replace(/^Club van 50 van SEV\b/i, "Club van 50");
}

function meta(html, key) {
  for (const match of html.matchAll(/<meta\s+([^>]+)>/gi)) {
    const attributes = Object.fromEntries(
      [...match[1].matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)]
        .map((attribute) => [attribute[1].toLowerCase(), decodeEntities(attribute[3])])
    );
    if (attributes.property === key || attributes.name === key) return attributes.content ?? "";
  }
  return "";
}

function searchUrl(query) {
  return `${SEV_ORIGIN}/?${new URLSearchParams({ s: query })}`;
}

function absoluteLink(value) {
  if (!value) return "";
  try {
    const url = new URL(decodeEntities(value), SEV_ORIGIN);
    return url.origin === SEV_ORIGIN ? url.href.replace(/\/$/, "") : "";
  } catch { return ""; }
}

function extractSearchPage(html) {
  const $ = load(html);
  const links = $(".nxs-archiveentry-row").toArray()
    .map((entry) => absoluteLink($(entry).closest("a").attr("href") || "")).filter(Boolean);
  const nextNode = $("a, link").toArray().find((entry) => {
    const node = $(entry);
    return /(?:^|\s)next(?:\s|$)/i.test(node.attr("rel") || "")
      || /(?:^|[\s_-])next(?:[\s_-]|$)/i.test(node.attr("class") || "")
      || /^(?:volgende|next|older posts|›|»)$/i.test(node.text().trim());
  });
  const next = nextNode ? $(nextNode).attr("href") : "";

  return { links: [...new Set(links)].filter((link) =>
    !/\/vereniging\/de-investering\/?$/i.test(link)
  ), next: next ? absoluteLink(next) : "" };
}

function extractSearchLinks(html) { return extractSearchPage(html).links; }

function mentionsInvestment(value = "") {
  return /\bclub\s+van\s+50\b/i.test(value)
    || /(?:^|\W)(?:de\s+)?investering(?:\W|$)/i.test(value);
}

function makeExcerpt(value = "") {
  const text = shortenBrandName(cleanText(value));
  if (text.length <= 260) return text;

  const shortened = text.slice(0, 257);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > 190 ? lastSpace : 257).replace(/[\s,;:.!?-]+$/, "")}…`;
}

function articleBodyText(html = "") {
  return extractArticleText(html);
}

function evidenceExcerpt(value = "") {
  const text = shortenBrandName(cleanText(value));
  const match = text.match(/club\s+van\s+50|(?:de\s+)?investering/i);
  if (!match) return makeExcerpt(text);
  const start = Math.max(0, match.index - 105);
  const end = Math.min(text.length, match.index + match[0].length + 155);
  return makeExcerpt(`${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`);
}

async function fetchText(url, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml;q=0.9",
      "User-Agent": "SEV-clubsite-concept/1.0 (+https://www.sev-voetbal.nl/)"
    },
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) throw new Error(`Nieuwsbron antwoordde met status ${response.status}`);
  return response.text();
}

async function fetchCandidateLinks(fetchImpl, maxPages = 40) {
  const results = await Promise.all(SEARCH_QUERIES.map(async (query) => {
    const found = [];
    const visited = new Set();
    let url = searchUrl(query);
    let hadFailure = false;
    const failures = [];
    for (let page = 0; page < maxPages && url && !visited.has(url); page += 1) {
      visited.add(url);
      try {
        const result = extractSearchPage(await fetchText(url, fetchImpl));
        found.push(...result.links);
        url = result.next && result.next !== url ? result.next : "";
      } catch (error) {
        failures.push({ link: url, reason: String(error.message || error) });
        hadFailure = true;
        url = "";
      }
    }
    if (url) failures.push({ link: url, reason: "Zoekpaginering is onvolledig of herhaalt een eerdere pagina" });
    if (!found.length) failures.push({ link: searchUrl(query), reason: "Bron gaf geen herkenbare zoekresultaten" });
    return { links: found, failures, hadFailure: hadFailure || Boolean(url) || !found.length };
  }));
  return { links: [...new Set(results.flatMap((result) => result.links))],
    failures: results.flatMap((result) => result.failures),
    hadFailure: results.some((result) => result.hadFailure) };
}

async function fetchArticle(link, fetchImpl) {
  const html = await fetchText(link, fetchImpl);
  const title = normalizeNewsTitle(meta(html, "og:title") || cleanText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]));
  const description = meta(html, "og:description") || meta(html, "description");
  const pageText = articleBodyText(html);

  if (!mentionsInvestment(`${title} ${description} ${pageText}`)) return null;

  const published = meta(html, "article:published_time");
  const date = new Date(published);
  return {
    id: link,
    title,
    link,
    date: Number.isNaN(date.getTime()) ? null : date.toISOString(),
    category: "Club van 50",
    excerpt: evidenceExcerpt(pageText || description || title),
    image: meta(html, "og:image")
  };
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      try {
        results[index] = { status: "fulfilled", value: await mapper(values[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

export async function collectInvestmentNews({ fetchImpl = globalThis.fetch, seedItems = snapshot.items,
  maxPages = 40 } = {}) {
  const search = await fetchCandidateLinks(fetchImpl, maxPages);
  // Recheck known URLs too: a source-search change must not lose body-only thanks.
  const links = [...new Set([...search.links, ...seedItems.map((item) => item.link)])];
  const results = await mapWithConcurrency(links, 8, (link) => fetchArticle(link, fetchImpl));
  const previous = new Map(seedItems.map((item) => [item.link, item]));
  const items = results.flatMap((result) => {
    if (result.status !== "fulfilled" || !result.value) return [];
    const item = result.value;
    return [{ ...item, date: item.date || previous.get(item.link)?.date || null }];
  });
  return { source: SOURCE_URL, verifiedAt: new Date().toISOString(),
    complete: !search.hadFailure && results.every((result) => result.status === "fulfilled"),
    candidatesChecked: links.length,
    failures: [...search.failures, ...results.flatMap((result, index) => result.status === "rejected"
      ? [{ link: links[index], reason: String(result.reason?.message || result.reason) }] : [])],
    items: dedupeNews(items) };
}

export function createInvestmentNewsService({ seed = snapshot, fetchImpl = (...args) => globalThis.fetch(...args), now = Date.now } = {}) {
  const index = new NewsIndex(seed, { ttl: 900000, now });
  const load = () => collectInvestmentNews({ fetchImpl, seedItems: index.items });
  return {
    async getInvestmentNews(limit = 30, options = {}) {
      const items = await index.serve(load, options);
      return items.slice(0, Math.min(Math.max(Number(limit) || 30, 1), 500));
    },
    getInvestmentNewsMeta: () => index.meta(),
    refresh: () => index.refresh(load)
  };
}

const service = createInvestmentNewsService();
export const getInvestmentNews = (...args) => service.getInvestmentNews(...args);
export const getInvestmentNewsMeta = () => service.getInvestmentNewsMeta();
export { SOURCE_URL, articleBodyText, evidenceExcerpt, extractSearchPage };
