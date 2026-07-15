const SOURCE_URL = "https://www.sev-voetbal.nl/feed/";
const CACHE_TIME = 5 * 60 * 1000;

let cache = { expires: 0, items: [] };
let archiveCache = { key: "", expires: 0, items: [] };

const ARCHIVE_CACHE_TIME = 15 * 60 * 1000;
const ARCHIVE_BATCH_SIZE = 5;
const MAX_ARCHIVE_PAGES = 60;
const AUDIENCE_RULES = {
  jeugd: /\b(?:jeugd|junior(?:en)?|pupil(?:len)?|jongens?|meisjes?|jo\s?-?\d{1,2}|mo\s?-?\d{1,2}|onder\s?\d{1,2}|o\d{1,2})\b/i,
  senioren: /\b(?:senior(?:en)?|selectie|sev\s*[1-9]\b|eerste|tweede|heren|dames|vrouwen)\b/i,
  veteranen: /\b(?:veteraan|veteranen|35\+|45\+|walking football|oldstars?)\b/i,
  g: /\b(?:g[-\s]?(?:voetbal|team|jeugd|spelers?|toernooi)|sev\s*g\d?)\b/i,
  kleuters: /\b(?:peuters?|kleuters?|mini(?:'s|s)?|allerkleinsten|ukkies?)\b/i
};

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

function normalizeList(values) {
  const list = Array.isArray(values) ? values : String(values || "").split(",");
  return [...new Set(list.map((value) => String(value).trim().toLowerCase()).filter(Boolean))];
}

function normalizeSearch(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function audiencesFor(item) {
  const text = `${item.title} ${item.excerpt} ${item.category}`;
  return Object.entries(AUDIENCE_RULES)
    .filter(([, pattern]) => pattern.test(text))
    .map(([audience]) => audience);
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

export async function getNewsArchivePage({
  archiveYears = [2026, 2025],
  years = [],
  audiences = [],
  search = "",
  page = 1,
  perPage = 18
} = {}) {
  const items = await getNewsByYears(archiveYears);
  const selectedYears = new Set(normalizeYears(years));
  const selectedAudiences = new Set(normalizeList(audiences).filter((value) => value in AUDIENCE_RULES));
  const query = normalizeSearch(search);
  const safePage = Math.max(Number(page) || 1, 1);
  const safePerPage = Math.min(Math.max(Number(perPage) || 18, 6), 36);

  const enriched = items.map((item) => ({ ...item, audiences: audiencesFor(item) }));
  const filtered = enriched.filter((item) => {
    const year = new Date(item.date).getFullYear();
    if (selectedYears.size && !selectedYears.has(year)) return false;
    if (selectedAudiences.size && !item.audiences.some((audience) => selectedAudiences.has(audience))) return false;
    if (query && !normalizeSearch(`${item.title} ${item.excerpt} ${item.category}`).includes(query)) return false;
    return true;
  });

  const start = (safePage - 1) * safePerPage;
  const pageItems = filtered.slice(start, start + safePerPage);
  const totalPages = Math.ceil(filtered.length / safePerPage);

  return {
    items: pageItems,
    page: safePage,
    perPage: safePerPage,
    total: filtered.length,
    totalPages,
    hasMore: safePage < totalPages,
    availableYears: [...new Set(items.map((item) => new Date(item.date).getFullYear()))].sort((a, b) => b - a)
  };
}

export { SOURCE_URL };
