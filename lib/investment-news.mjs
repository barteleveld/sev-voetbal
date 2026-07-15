const SOURCE_URL = "https://www.sev-voetbal.nl/?s=investering";
const CACHE_TIME = 15 * 60 * 1000;
const SEARCH_QUERIES = ["investering", "club van 50"];
const SEV_ORIGIN = "https://www.sev-voetbal.nl";

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
      [...match[1].matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)]
        .map((attribute) => [attribute[1].toLowerCase(), decodeEntities(attribute[2])])
    );
    if (attributes.property === key || attributes.name === key) return attributes.content ?? "";
  }
  return "";
}

function searchUrl(query) {
  return `${SEV_ORIGIN}/?${new URLSearchParams({ s: query })}`;
}

function extractSearchLinks(html) {
  const links = [...html.matchAll(
    /<a\s+[^>]*href=["'](https?:\/\/www\.sev-voetbal\.nl\/[^"'#?]+)["'][^>]*>\s*<div\s+[^>]*class=["'][^"']*\bnxs-archiveentry-row\b[^"']*["']/gi
  )].map((match) => decodeEntities(match[1]).replace(/\/$/, ""));

  return [...new Set(links)].filter((link) =>
    !/\/vereniging\/de-investering\/?$/i.test(link)
  );
}

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

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml;q=0.9",
      "User-Agent": "SEV-clubsite-concept/1.0 (+https://www.sev-voetbal.nl/)"
    },
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) throw new Error(`Nieuwsbron antwoordde met status ${response.status}`);
  return response.text();
}

async function fetchCandidateLinks() {
  const results = await Promise.allSettled(
    SEARCH_QUERIES.map(async (query) => extractSearchLinks(await fetchText(searchUrl(query))))
  );
  const links = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  return [...new Set(links)];
}

async function fetchArticle(link) {
  const html = await fetchText(link);
  const title = normalizeNewsTitle(meta(html, "og:title") || cleanText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]));
  const description = meta(html, "og:description") || meta(html, "description");
  const pageText = cleanText(html);

  if (!mentionsInvestment(`${title} ${description} ${pageText}`)) return null;

  const published = meta(html, "article:published_time");
  const date = new Date(published);
  return {
    id: link,
    title,
    link,
    date: Number.isNaN(date.getTime()) ? null : date.toISOString(),
    category: "Club van 50",
    excerpt: makeExcerpt(description),
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

export async function getInvestmentNews(limit = 30) {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const now = Date.now();

  if (cache.expires > now && cache.items.length) {
    return cache.items.slice(0, safeLimit);
  }

  const links = await fetchCandidateLinks();
  const results = await mapWithConcurrency(links, 4, fetchArticle);
  const items = results
    .flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : [])
    .filter((item, index, all) => all.findIndex((candidate) => candidate.link === item.link) === index)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  if (!items.length) throw new Error('Geen nieuwsitems over Club van 50 "De InVESTEring" gevonden');

  cache = { expires: now + CACHE_TIME, items };
  return items.slice(0, safeLimit);
}

export { SOURCE_URL };
