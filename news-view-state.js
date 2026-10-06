import { dedupeNews } from "./news-utils.js";

export function formatNewsProgress(visible, total) {
  return `${Math.min(visible, total).toLocaleString("nl-NL")} van ${total.toLocaleString("nl-NL")} berichten getoond`;
}

export function createArchiveView({ url, perPage, items, page, total, hasMore, scrollY, filtersOpen }, now = Date.now()) {
  return { version: 1, url, perPage, items: dedupeNews(items), page, total, hasMore,
    scrollY: Math.max(0, Number(scrollY) || 0), filtersOpen: Boolean(filtersOpen), savedAt: now };
}

export function readArchiveView(value, { url, perPage, now = Date.now() }) {
  try {
    const view = typeof value === "string" ? JSON.parse(value) : value;
    if (!view || view.version !== 1 || view.url !== url || view.perPage !== perPage
      || !Number.isFinite(view.savedAt) || now - view.savedAt > 86400000 || view.savedAt > now + 60000
      || !Number.isInteger(view.page) || view.page < 1 || !Number.isInteger(view.total) || view.total < 1
      || !Array.isArray(view.items) || !view.items.length || view.items.length > view.total
      || view.page > Math.ceil(view.total / perPage)) return null;
    const items = dedupeNews(view.items);
    if (!items.length) return null;
    return { ...view, items, hasMore: view.page * perPage < view.total,
      scrollY: Number.isFinite(view.scrollY) ? Math.max(0, view.scrollY) : 0 };
  } catch { return null; }
}
