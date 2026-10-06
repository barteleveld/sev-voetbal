import { dedupeNews } from "../news-utils.js";

// Bundled JSON is the durable baseline; memory is never the sole fallback.
export class NewsIndex {
  constructor(snapshot, { ttl = 900000, now = Date.now } = {}) {
    this.items = dedupeNews(snapshot.items);
    this.sourceUpdatedAt = snapshot.verifiedAt || null;
    this.complete = snapshot.complete === true;
    this.coverageYears = snapshot.coverageYears || [];
    this.ttl = ttl;
    this.now = now;
    this.expires = this.sourceUpdatedAt ? Date.parse(this.sourceUpdatedAt) + ttl : 0;
    this.retryAt = 0;
    this.incomplete = false;
    this.pending = null;
  }

  async refresh(loader) {
    if (this.pending) return this.pending;
    this.pending = Promise.resolve().then(loader).then((result) => {
      if (!Array.isArray(result.items) || !result.items.length) throw new Error("Lege nieuwsindex geweigerd");
      // Partial scans may add items, but can never erase the previous collection.
      this.items = dedupeNews([...this.items, ...result.items]);
      this.incomplete = !result.complete;
      if (result.complete) {
        this.sourceUpdatedAt = result.verifiedAt || new Date(this.now()).toISOString();
        this.complete = true;
        this.coverageYears = result.coverageYears || this.coverageYears;
        this.expires = this.now() + this.ttl;
        this.retryAt = 0;
      } else this.retryAt = this.now() + 60000;
      return this.items;
    }).catch((error) => {
      this.incomplete = true;
      this.retryAt = this.now() + 60000;
      if (!this.items.length) throw error;
      console.warn(`[SEV nieuws] Laatste volledige index behouden: ${error.message}`);
      return this.items;
    }).finally(() => { this.pending = null; });
    return this.pending;
  }

  async serve(loader, { waitUntil, refresh = true } = {}) {
    if (!this.items.length) return this.refresh(loader);
    if (refresh && this.now() >= this.expires && this.now() >= this.retryAt) {
      const pending = this.refresh(loader);
      if (waitUntil) waitUntil(pending);
    } else if (waitUntil && this.pending) waitUntil(this.pending);
    return this.items;
  }

  meta() {
    return { stale: this.incomplete || this.now() >= this.expires,
      refreshing: Boolean(this.pending), complete: this.complete,
      sourceUpdatedAt: this.sourceUpdatedAt, coverageYears: this.coverageYears };
  }
}
