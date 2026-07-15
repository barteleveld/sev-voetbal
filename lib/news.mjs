const SOURCE_URL = "https://www.sev-voetbal.nl/feed/";
const CACHE_TIME = 5 * 60 * 1000;

let cache = { expires: 0, items: [] };
let archiveCache = { key: "", expires: 0, items: [] };

const ARCHIVE_CACHE_TIME = 15 * 60 * 1000;
const ARCHIVE_BATCH_SIZE = 5;
const MAX_ARCHIVE_PAGES = 60;

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
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  if (!match) return "";
  return match[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim();
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
    .replace(/([.!?])([A-ZÀ-ÖØ-Þ])/g, "$1 $2")
    .replace(/\/?\s*Zie voor meer informatie onze website\.?/i, "")
    .trim();
}

function parseItem(xml, index) {
  const description = tag(xml, "description");
  const image = description.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? "";
  const date = new Date(cleanText(tag(xml, "pubDate")));
  const category = cleanText(tag(xml, "category")) || "Clubnieuws";

  return {
    id: cleanText(tag(xml, "guid")) || `sev-news-${index}`,
    title: cleanText(tag(xml, "title")),
    link: cleanText(tag(xml, "link")),
    date: Number.isNaN(date.getTime()) ? null : date.toISOString(),
    category,
    excerpt: cleanText(description).replace(/\s*\.{3}\s*\.?$/, "…"),
    image: decodeEntities(image)
  };
}

function parseFeed(xml, page = 1) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map((match, index) => parseItem(match[1], `${page}-${index}`))
    .filter((item) => item.title && item.link);
}

async function fetchFeedPage(page = 1) {
  const url = page === 1 ? SOURCE_URL : `${SOURCE_URL}?paged=${page}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
      "User-Agent": "SEV-clubsite-concept/1.0 (+https://www.sev-voetbal.nl/)"
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`Nieuwsbron antwoordde op pagina ${page} met status ${response.status}`);
  }

  return parseFeed(await response.text(), page);
}

function normalizeYears(years) {
  const values = Array.isArray(years) ? years : String(years || "").split(",");
  return [...new Set(values
    .map(Number)
    .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2100))]
    .sort((a, b) => b - a);
}

export async function getLatestNews(limit = 10) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);
  const now = Date.now();

  if (cache.expires > now && cache.items.length >= safeLimit) {
    return cache.items.slice(0, safeLimit);
  }

  const items = await fetchFeedPage(1);

  if (!items.length) throw new Error("Geen nieuwsitems in de feed gevonden");

  cache = { expires: now + CACHE_TIME, items };
  return items.slice(0, safeLimit);
}

export async function getNewsByYears(years = [2026, 2025]) {
  const wantedYears = normalizeYears(years);
  if (!wantedYears.length) throw new Error("Geen geldige nieuwsjaren opgegeven");

  const now = Date.now();
  const cacheKey = wantedYears.join(",");
  if (archiveCache.key === cacheKey && archiveCache.expires > now && archiveCache.items.length) {
    return archiveCache.items;
  }

  const oldestWantedYear = Math.min(...wantedYears);
  const collected = [];
  let reachedEarlierNews = false;

  for (let start = 1; start <= MAX_ARCHIVE_PAGES && !reachedEarlierNews; start += ARCHIVE_BATCH_SIZE) {
    const pages = Array.from({ length: ARCHIVE_BATCH_SIZE }, (_, index) => start + index)
      .filter((page) => page <= MAX_ARCHIVE_PAGES);
    const results = await Promise.all(pages.map((page) => fetchFeedPage(page)));

    for (const pageItems of results) {
      collected.push(...pageItems);
      if (!pageItems.length || pageItems.some((item) => item.date && new Date(item.date).getFullYear() < oldestWantedYear)) {
        reachedEarlierNews = true;
      }
    }
  }

  const wanted = new Set(wantedYears);
  const items = collected
    .filter((item, index, all) => all.findIndex((candidate) => candidate.link === item.link) === index)
    .filter((item) => item.date && wanted.has(new Date(item.date).getFullYear()))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!items.length) throw new Error(`Geen nieuwsitems uit ${cacheKey} gevonden`);

  archiveCache = { key: cacheKey, expires: now + ARCHIVE_CACHE_TIME, items };
  return items;
}

export { SOURCE_URL };
