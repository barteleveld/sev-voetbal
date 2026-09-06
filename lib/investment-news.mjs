import snapshot from "./investment-news-snapshot.json" with { type: "json" };

const SOURCE_URL = "https://www.sev-voetbal.nl/?s=investering";
const CACHE_TIME = 15 * 60 * 1000;
const SEARCH_QUERIES = ["investering", "club van 50"];
const SEV_ORIGIN = "https://www.sev-voetbal.nl";

let cache = { expires: 0, items: [] };
let lastSuccessfulItems = Array.isArray(snapshot.items) ? snapshot.items : [];
let lastSuccessfulAt = snapshot.verifiedAt || null;
let lastFetchHadFailure = false;
let lastSearchHadFailure = false;

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

function absoluteLink(value) {
  try {
    const url = new URL(decodeEntities(value), SEV_ORIGIN);
    return url.origin === SEV_ORIGIN ? url.href.replace(/\/$/, "") : "";
  } catch { return ""; }
}

function extractSearchPage(html) {
  const links = [...html.matchAll(/<a\s+[^>]*href=["']([^"'#?]+)["'][^>]*>\s*<div\s+[^>]*class=["'][^"']*\bnxs-archiveentry-row\b[^"']*["']/gi)]
    .map((match) => absoluteLink(match[1]))
    .filter(Boolean);
  const next = html.match(/<a\s+[^>]*(?:rel|class)=["'][^"']*(?:next|pagination)[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1]
    || html.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*(?:rel|class)=["'][^"']*(?:next|pagination)[^"']*["']/i)?.[1]
    || html.match(/<link\s+[^>]*rel=["']next["'][^>]*href=["']([^"']+)["']/i)?.[1];

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
  const openings = [/<article\b[^>]*>/i, /<main\b[^>]*>/i, /<(?:div|section)\b[^>]*class=["'][^"']*(?:entry-content|article-content|post-content|single-content)[^"']*["'][^>]*>/i, /<div\s+id=["']nxs-content["'][^>]*>/i];
  const opening = openings.map((pattern) => pattern.exec(html)).filter(Boolean).sort((a, b) => a.index - b.index)[0];
  if (!opening) return "";
  const tagName = opening[0].match(/^<([\w-]+)/)[1];
  const tokens = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
  const start = opening.index + opening[0].length;
  let depth = 1; let token;
  while ((token = tokens.exec(html.slice(start)))) {
    if (/^<\//.test(token[0])) depth -= 1;
    else if (!/\/\s*>$/.test(token[0])) depth += 1;
    if (!depth) {
      const body = html.slice(start, start + token.index)
        .replace(/<(?:nav|header|footer|aside|form|script|style)\b[\s\S]*?<\/(?:nav|header|footer|aside|form|script|style)>/gi, " ");
      return cleanText(body);
    }
  }
  return "";
}

function evidenceExcerpt(value = "") {
  const text = shortenBrandName(cleanText(value));
  const match = text.match(/club\s+van\s+50|(?:de\s+)?investering/i);
  if (!match) return makeExcerpt(text);
  const start = Math.max(0, match.index - 105);
  const end = Math.min(text.length, match.index + match[0].length + 155);
  return makeExcerpt(`${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`);
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
  const found = [];
  const visited = new Set();
  let hadFailure = false;
  for (const query of SEARCH_QUERIES) {
    let url = searchUrl(query);
    for (let page = 0; page < 8 && url && !visited.has(url); page += 1) {
      visited.add(url);
      try {
        const result = extractSearchPage(await fetchText(url));
        found.push(...result.links);
        url = result.next && result.next !== url ? result.next : "";
      } catch { hadFailure = true; url = ""; }
    }
  }
  return { links: [...new Set(found)], hadFailure };
}

async function fetchArticle(link) {
  const html = await fetchText(link);
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

export async function getInvestmentNews(limit = 30) {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const now = Date.now();

  if (cache.expires > now && cache.items.length) {
    return cache.items.slice(0, safeLimit);
  }

  let search;
  try { search = await fetchCandidateLinks(); } catch (error) {
    if (lastSuccessfulItems.length) return lastSuccessfulItems.slice(0, safeLimit);
    throw error;
  }
  const { links, hadFailure: searchFailure } = search;
  lastSearchHadFailure = searchFailure;
  const results = await mapWithConcurrency(links, 4, fetchArticle);
  const freshItems = results
    .flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : [])
    .filter((item, index, all) => all.findIndex((candidate) => candidate.link === item.link) === index)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const failedLinks = new Set(results.flatMap((result, index) => result.status === "rejected" ? [links[index]] : []));
  lastFetchHadFailure = failedLinks.size > 0;
  const items = (failedLinks.size || searchFailure)
    ? [...freshItems, ...lastSuccessfulItems.filter((item) => failedLinks.has(item.link) || searchFailure)]
      .filter((item, index, all) => all.findIndex((candidate) => candidate.link === item.link) === index)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    : freshItems;

  if (!items.length) {
    if (lastSuccessfulItems.length) return lastSuccessfulItems.slice(0, safeLimit);
    throw new Error('Geen nieuwsitems over Club van 50 "De InVESTEring" gevonden');
  }

  cache = { expires: now + CACHE_TIME, items };
  lastSuccessfulItems = items;
  if (!lastFetchHadFailure && !lastSearchHadFailure) lastSuccessfulAt = new Date(now).toISOString();
  return items.slice(0, safeLimit);
}

export function getInvestmentNewsMeta() {
  return { stale: lastFetchHadFailure || lastSearchHadFailure || cache.expires <= Date.now(), sourceUpdatedAt: lastSuccessfulAt };
}

export { SOURCE_URL, articleBodyText, evidenceExcerpt, extractSearchPage };
