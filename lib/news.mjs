import snapshot from "./news-snapshot.json" with { type: "json" };
import { NewsIndex } from "./news-index.mjs";
import { AUDIENCE_RULES, audiencesFor, dedupeNews, normalizeText, normalizeNewsSearch, newsKind, selectNewsKind } from "../news-utils.js";
import { createHash } from "node:crypto";
import { extractArticleText } from "./article-text.mjs";

export const SOURCE_URL = "https://www.sev-voetbal.nl/feed/";
export const getDefaultArchiveYears = () => Array.from(
  { length: Math.max(new Date().getFullYear() - 2025 + 1, 1) },
  (_, index) => new Date().getFullYear() - index);

export function decodeEntities(value = "") {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"',
    rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", ndash: "–", mdash: "—" };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] !== "#") return named[entity.toLowerCase()] ?? match;
    const hex = entity[1].toLowerCase() === "x";
    const parsed = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 0x10ffff ? String.fromCodePoint(parsed) : match;
  });
}

export function cleanText(html = "") {
  return decodeEntities(html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([.!?])([A-ZÀ-ÖØ-Þ])/g, "$1 $2")
    .replace(/\/?\s*Zie voor meer informatie onze website\.?/i, "").trim();
}

function tag(xml, name) {
  return (xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] || "")
    .replace(/^<!\[CDATA\[|\]\]>$/g, "").trim();
}

export function parseFeed(xml, page = 1) {
  if (!/<rss\b|<rdf:RDF\b/i.test(xml)) throw new Error("Nieuwsbron gaf geen geldige RSS-feed terug");
  return dedupeNews([...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(([ , item], index) => {
    const description = tag(item, "description");
    const date = new Date(cleanText(tag(item, "pubDate")));
    const categories = [...item.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi)]
      .map(([, value]) => cleanText(value.replace(/^<!\[CDATA\[|\]\]>$/g, "")));
    return { id: cleanText(tag(item, "guid")) || `sev-${page}-${index}`,
      title: cleanText(tag(item, "title")), link: cleanText(tag(item, "link")),
      date: Number.isNaN(date.getTime()) ? null : date.toISOString(),
      category: categories[0] || "Clubnieuws", categories,
      excerpt: cleanText(description).replace(/\s*\.{3}\s*\.?$/, "…"),
      searchText: cleanText(tag(item, "content:encoded") || description),
      image: decodeEntities(description.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || "") };
  }));
}

async function fetchFeedPage(page, fetchImpl) {
  const response = await fetchImpl(page === 1 ? SOURCE_URL : `${SOURCE_URL}?paged=${page}`, {
    headers: { Accept: "application/rss+xml,application/xml;q=0.9", "User-Agent": "SEV-clubsite/2.0" },
    signal: AbortSignal.timeout(10000) });
  if (response.status === 404 && page > 1) return [];
  if (!response.ok) throw new Error(`RSS-pagina ${page}: status ${response.status}`);
  return parseFeed(await response.text(), page);
}

export function normalizeYears(years) {
  const values = Array.isArray(years) ? years : String(years || "").split(",");
  return [...new Set(values.map(Number).filter((y) => Number.isInteger(y) && y >= 2000 && y <= 2100))].sort((a, b) => b - a);
}

export async function verifyContentDuplicates(items, fetchImpl = globalThis.fetch) {
  const groups = new Map();
  for (const item of items) {
    const text = normalizeText(item.excerpt);
    if (text.length < 80 || !item.date) continue;
    const key = `${newsKind(item)}|${item.date.slice(0, 10)}|${normalizeText(item.title)}`;
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  const candidates = [...groups.values()].filter((group) => group.length > 1).flat();
  for (let start = 0; start < candidates.length; start += 4) {
    await Promise.all(candidates.slice(start, start + 4).map(async (item) => {
      try {
        const response = await fetchImpl(item.link, { signal: AbortSignal.timeout(10000),
          headers: { Accept: "text/html", "User-Agent": "SEV-clubsite/2.0" } });
        if (!response.ok) return;
        let text = normalizeText(extractArticleText(await response.text()));
        const title = normalizeText(item.title);
        // Some source versions repeat the article title inside the text widget.
        // Ignore only that exact heading, not differences in the actual story.
        if (title && text.startsWith(`${title} `)) text = text.slice(title.length).trim();
        if (text.length >= 80) item.contentHash = createHash("sha256").update(text).digest("hex");
      } catch { /* Keep both articles when their full content cannot be verified. */ }
    }));
  }
  return dedupeNews(items);
}

export async function collectNewsArchive({ years = getDefaultArchiveYears(), fetchImpl = globalThis.fetch,
  maxPages = 120, concurrency = 4 } = {}) {
  const wanted = normalizeYears(years);
  if (!wanted.length) throw new Error("Geen geldige nieuwsjaren opgegeven");
  const items = [];
  let boundary = false;
  let failed = false;
  let pagesRead = 0;
  for (let start = 1; start <= maxPages && !boundary; start += concurrency) {
    const pages = Array.from({ length: Math.min(concurrency, maxPages - start + 1) }, (_, i) => start + i);
    const results = await Promise.allSettled(pages.map((p) => fetchFeedPage(p, fetchImpl)));
    pagesRead += pages.length;
    for (const result of results) {
      if (result.status === "rejected") { failed = true; continue; }
      items.push(...result.value);
      if (!result.value.length || result.value.some((item) => item.date && new Date(item.date).getFullYear() < Math.min(...wanted))) boundary = true;
    }
    if (results.some((result) => result.status === "rejected")) break;
  }
  const selected = dedupeNews(items).filter((item) => item.date && wanted.includes(new Date(item.date).getFullYear()));
  return { source: SOURCE_URL, verifiedAt: new Date().toISOString(), complete: boundary && !failed,
    coverageYears: wanted, pagesRead, items: await verifyContentDuplicates(selected, fetchImpl) };
}

export function createNewsService({ seed = snapshot, fetchImpl = (...args) => globalThis.fetch(...args), now = Date.now } = {}) {
  const archiveIndex = new NewsIndex(seed, { ttl: 900000, now });
  const latestIndex = new NewsIndex(seed, { ttl: 300000, now });
  const loadLatest = async () => {
    const results = await Promise.allSettled([1, 2].map((p) => fetchFeedPage(p, fetchImpl)));
    return { items: results.flatMap((r) => r.status === "fulfilled" ? r.value : []),
      complete: results.every((r) => r.status === "fulfilled"), verifiedAt: new Date(now()).toISOString() };
  };
  return {
    async getLatestNews(limit = 10, options = {}) {
      const items = await latestIndex.serve(loadLatest, options);
      return selectNewsKind(items, options.kind).slice(0, Math.min(Math.max(Number(limit) || 10, 1), 20));
    },
    async getNewsByYears(years = getDefaultArchiveYears(), options = {}) {
      const wanted = normalizeYears(years);
      if (!wanted.length) throw new Error("Geen geldige nieuwsjaren opgegeven");
      const coverage = [...new Set([...getDefaultArchiveYears(), ...wanted])];
      const items = await archiveIndex.serve(() => collectNewsArchive({ years: coverage, fetchImpl }), options);
      return items.filter((item) => item.date && wanted.includes(new Date(item.date).getFullYear()));
    },
    async getNewsArchivePage({ archiveYears = getDefaultArchiveYears(), years = [], audiences = [], search = "",
      page = 1, perPage = 18, kind = "news", ...options } = {}) {
      const items = await this.getNewsByYears(archiveYears, options);
      const selectedYears = normalizeYears(years);
      const selectedAudiences = (Array.isArray(audiences) ? audiences : String(audiences || "").split(",")).filter((v) => v in AUDIENCE_RULES);
      const query = normalizeNewsSearch(search);
      const kindItems = selectNewsKind(items, kind);
      const filtered = kindItems.map((item) => ({ ...item, audiences: audiencesFor(item) })).filter((item) =>
        (!selectedYears.length || selectedYears.includes(new Date(item.date).getFullYear()))
        && (!selectedAudiences.length || item.audiences.some((v) => selectedAudiences.includes(v)))
        && (!query || normalizeNewsSearch(`${item.title} ${item.excerpt} ${item.searchText || ""} ${item.category}`).includes(query)));
      const safePage = Math.max(Math.floor(Number(page) || 1), 1);
      const safePerPage = Math.min(Math.max(Math.floor(Number(perPage) || 18), 6), 36);
      const totalPages = Math.ceil(filtered.length / safePerPage);
      return { items: filtered.slice((safePage - 1) * safePerPage, safePage * safePerPage), page: safePage,
        perPage: safePerPage, total: filtered.length, totalPages, hasMore: safePage < totalPages,
        kind: kind === "reports" ? "reports" : "news",
        availableYears: [...new Set(kindItems.map((item) => new Date(item.date).getFullYear()))].sort((a, b) => b - a) };
    },
    getLatestNewsMeta: () => latestIndex.meta(),
    getNewsArchiveMeta: () => archiveIndex.meta(),
    refreshArchive: () => archiveIndex.refresh(() => collectNewsArchive({ fetchImpl }))
  };
}

const service = createNewsService();
export const getLatestNews = (...args) => service.getLatestNews(...args);
export const getNewsByYears = (...args) => service.getNewsByYears(...args);
export const getNewsArchivePage = (...args) => service.getNewsArchivePage(...args);
export const getLatestNewsMeta = () => service.getLatestNewsMeta();
export const getNewsArchiveMeta = () => service.getNewsArchiveMeta();
