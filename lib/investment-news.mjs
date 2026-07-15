const SOURCE_URL = "https://www.sev-voetbal.nl/?s=investering&feed=rss2";
const CACHE_TIME = 15 * 60 * 1000;

let cache = { expires: 0, items: [] };

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

function shortenBrandName(value = "") {
  return value
    .replace(/Club van 50\s*[‘'“"]?De InVESTEring[’'”"]?/gi, "Club van 50")
    .replace(/[‘'“"]?\bde\s+InVESTEring\b[’'”"]?/gi, "Club van 50")
    .replace(/[‘'“"]?\bInVESTEring\b[’'”"]?/gi, "Club van 50");
}

function normalizeNewsTitle(value = "") {
  if (/breidt naam uit met Club van 50/i.test(value)) {
    return 'Club van 50 "De InVESTEring" krijgt een herkenbare naam';
  }

  const fullName = 'Club van 50 "De InVESTEring"';
  const normalizedFullName = value.replace(
    /Club van 50\s*[‘'“"]?De InVESTEring[’'”"]?/gi,
    fullName
  );
  return normalizedFullName.includes(fullName)
    ? normalizedFullName
    : shortenBrandName(normalizedFullName).replace(/^Club van 50 van SEV\b/i, "Club van 50");
}

function parseItem(xml, index) {
  const description = tag(xml, "description");
  const date = new Date(cleanText(tag(xml, "pubDate")));

  return {
    id: cleanText(tag(xml, "guid")) || `sev-investment-news-${index}`,
    title: normalizeNewsTitle(cleanText(tag(xml, "title"))),
    link: cleanText(tag(xml, "link")),
    date: Number.isNaN(date.getTime()) ? null : date.toISOString(),
    category: "Club van 50",
    excerpt: shortenBrandName(cleanText(description)).replace(/\s*\.{3}\s*\.?$/, "…"),
    image: decodeEntities(description.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? "")
  };
}

function parseFeed(xml, page) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map((match, index) => parseItem(match[1], `${page}-${index}`))
    .filter((item) => item.title && item.link && !/\/vereniging\/de-investering\/?$/i.test(item.link));
}

async function fetchFeed(url, page) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
      "User-Agent": "SEV-clubsite-concept/1.0 (+https://www.sev-voetbal.nl/)"
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) throw new Error(`Nieuwsbron antwoordde met status ${response.status}`);
  return parseFeed(await response.text(), page);
}

export async function getInvestmentNews(limit = 15) {
  const safeLimit = Math.min(Math.max(Number(limit) || 15, 1), 20);
  const now = Date.now();

  if (cache.expires > now && cache.items.length) {
    return cache.items.slice(0, safeLimit);
  }

  const sources = [SOURCE_URL, `${SOURCE_URL}&paged=2`];
  const results = await Promise.allSettled(sources.map((url, index) => fetchFeed(url, index + 1)));
  const items = results
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter((item, index, all) => all.findIndex((candidate) => candidate.link === item.link) === index)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  if (!items.length) throw new Error('Geen nieuwsitems over Club van 50 "De InVESTEring" gevonden');

  cache = { expires: now + CACHE_TIME, items };
  return items.slice(0, safeLimit);
}

export { SOURCE_URL };
