const SOURCE_URL = "https://www.sev-voetbal.nl/feed/";
const CACHE_TIME = 5 * 60 * 1000;

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

export async function getLatestNews(limit = 10) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);
  const now = Date.now();

  if (cache.expires > now && cache.items.length >= safeLimit) {
    return cache.items.slice(0, safeLimit);
  }

  const response = await fetch(SOURCE_URL, {
    headers: {
      Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
      "User-Agent": "SEV-clubsite-concept/1.0 (+https://www.sev-voetbal.nl/)"
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`Nieuwsbron antwoordde met status ${response.status}`);
  }

  const xml = await response.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map((match, index) => parseItem(match[1], index))
    .filter((item) => item.title && item.link);

  if (!items.length) throw new Error("Geen nieuwsitems in de feed gevonden");

  cache = { expires: now + CACHE_TIME, items };
  return items.slice(0, safeLimit);
}

export { SOURCE_URL };
