// Shared by the browser and the news index: no DOM or server dependencies.
export function normalizeText(value = "") {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[‐‑‒–—]/g, "-").replace(/[‘’]/g, "'").toLowerCase()
    .replace(/\s+/g, " ").trim();
}

// Alleen presentatietekst: oorspronkelijke brondata, artikel- en beeld-URL's blijven intact.
export function formatTeamNames(value = "") {
  return String(value ?? "").replace(/(https?:\/\/[^\s]+)|\b(?:J\s*\/\s*M\s*|J\s*)?O[\s-]*(\d{1,2})\b/gi,
    (match, url, age) => url || `O${age}`);
}

export function formatNewsForDisplay(item) {
  return { ...item, title: formatTeamNames(item.title), excerpt: formatTeamNames(item.excerpt),
    category: formatTeamNames(item.category) };
}

// Oude en nieuwe teamnamen leveren dezelfde zoekresultaten, ook in bronartikelen.
export function normalizeNewsSearch(value = "") {
  return normalizeText(formatTeamNames(value));
}

export function newsKind(item = {}) {
  return [item.category, ...(item.categories || [])].some((category) =>
    /\bwedstrijd[\s-]*versla(?:g|gen)\b/.test(normalizeText(category))) ? "reports" : "news";
}

export function selectNewsKind(items, kind = "news") {
  return items.filter((item) => newsKind(item) === (kind === "reports" ? "reports" : "news"));
}

export function canonicalNewsLink(value = "") {
  if (!value) return "";
  try {
    const url = new URL(value, "https://www.sev-voetbal.nl");
    if (!/^https?:$/.test(url.protocol)) return "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    }
    return url.href.replace(/\/$/, "");
  } catch { return ""; }
}

export function normalizeNewsImage(value = "") {
  const image = canonicalNewsLink(String(value || "").trim());
  if (!value || !image || /(?:wp-includes\/images\/media\/default\.(?:png|svg)|thumbnail-algemeen|cropped-logo|logo-512|(?:^|[/_-])(?:no-image|placeholder|default-image)(?:[._/-]|$))/i.test(image)) return "";
  return image;
}

export const AUDIENCE_RULES = {
  jeugd: /\b(?:jeugd|junior(?:en)?|pupil(?:len)?|jongens?|meisjes?|meiden|j\s*o\s*-?\s*\d{1,2}|m\s*o\s*-?\s*\d{1,2}|j\s*\/\s*m\s*o\s*\d{1,2}|onder\s*\d{1,2}|o\s*-?\s*\d{1,2})\b/i,
  senioren: /\b(?:senior(?:en)?|selectie|sev\s*[1-9]\b|(?:eerste|tweede)\s+elftal|heren|dames|vrouwen)\b/i,
  veteranen: /\b(?:veteraan|veteranen|walking\s*football|old\s*stars?)\b|(?:^|\W)(?:35|45)\s*\+/i,
  g: /\bg\s*-?\s*(?:voetbal(?:lers?)?|teams?|jeugd|spelers?|toernooien|toernooi|afdeling)\b|\bsev\s+g(?:\s*\d+)?\b/i,
  kleuters: /\b(?:peuters?|kleuters?|mini(?:'s|s)?|allerkleinsten|ukkies?|(?:jo|mo|o|j\s*\/\s*m\s*o)\s*-?\s*6)\b/i,
  vrouwen: /\b(?:vrouwen(?:voetbal)?|dames(?:team|voetbal)?|meiden(?:team|voetbal)?|m\s*o\s*-?\s*\d{1,2})\b/i,
  walking: /\b(?:walking\s*football|old\s*stars?|sev\s+wf)\b/i
};

export function audiencesFor(item) {
  const text = normalizeNewsSearch([item.title, item.excerpt, item.searchText, item.category,
    ...(item.categories || [])].filter(Boolean).join(" "));
  const explicit = (item.audiences || []).filter((value) => value in AUDIENCE_RULES);
  return [...new Set([...explicit, ...Object.entries(AUDIENCE_RULES)
    .filter(([, pattern]) => pattern.test(text)).map(([audience]) => audience)])];
}

export function dedupeNews(items = []) {
  const aliases = new Map(items.flatMap((item) => (item.duplicateLinks || [])
    .map((link) => [canonicalNewsLink(link), { link: canonicalNewsLink(item.link), kind: newsKind(item) }])));
  const byLink = new Map();
  for (const raw of items) {
    const canonical = canonicalNewsLink(raw.link);
    const alias = aliases.get(canonical);
    const link = alias?.kind === newsKind(raw) ? alias.link : canonical;
    if (!raw.title || !link) continue;
    const item = { ...raw, link, image: normalizeNewsImage(raw.image) };
    const previous = byLink.get(link);
    byLink.set(link, { ...previous, ...item, image: item.image || previous?.image || "" });
  }
  for (const item of byLink.values()) {
    if (item.duplicateLinks) item.duplicateLinks = item.duplicateLinks.filter((link) => {
      const separate = byLink.get(canonicalNewsLink(link));
      return !separate || newsKind(separate) === newsKind(item);
    });
  }
  const byContent = new Map();
  for (const item of byLink.values()) {
    // Only a hash of the verified FULL article is evidence of duplication.
    // Identical titles or truncated RSS introductions are not sufficient.
    const date = item.date && !Number.isNaN(Date.parse(item.date)) ? new Date(item.date).toISOString().slice(0, 10) : "";
    const key = item.contentHash && date
      ? `${newsKind(item)}|${date}|${normalizeText(item.title)}|${item.contentHash}` : item.link;
    const previous = byContent.get(key);
    if (!previous) byContent.set(key, item);
    else {
      const preferOriginal = new URL(item.link).pathname.length < new URL(previous.link).pathname.length;
      const preferred = preferOriginal ? item : previous;
      byContent.set(key, { ...preferred, image: preferred.image || item.image || previous.image,
        duplicateLinks: [...new Set([previous.link, item.link,
          ...(previous.duplicateLinks || []), ...(item.duplicateLinks || [])])].filter((link) => link !== preferred.link),
        audiences: [...new Set([...audiencesFor(previous), ...audiencesFor(item)])] });
    }
  }
  return [...byContent.values()].sort((a, b) =>
    (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) || a.link.localeCompare(b.link));
}
