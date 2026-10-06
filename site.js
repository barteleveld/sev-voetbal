import { dedupeNews, normalizeNewsImage, formatNewsForDisplay, selectNewsKind } from "./news-utils.js";
import { createArchiveView, readArchiveView, formatNewsProgress } from "./news-view-state.js";
import { initJoiningRoute } from "./joining.js";

const page = document.body.dataset.page || "home";
initJoiningRoute();
const scriptUrl = import.meta.url;
const assetBase = new URL("assets/", scriptUrl);
const assetPath = (path) => new URL(path.replace(/^assets\//, ""), assetBase).href;
const pageLinks = [
  ["home", "/", "Home"],
  ["news", "/nieuws", "Nieuws"],
  ["matches", "https://www.sev-voetbal.nl/programma-fw", "Wedstrijden"],
  ["member", "/lid-worden", "Nieuw bij SEV?"],
  ["club", "/clubzaken", "Clubzaken"],
  ["investment", "/de-investering", 'Club van 50 "De InVESTEring"']
];

function current(name) {
  return page === name ? ' aria-current="page"' : "";
}

const headerTarget = document.querySelector("[data-site-header]");
if (headerTarget) {
  headerTarget.outerHTML = `
    <div class="announcement">
      <div class="announcement__inner">
        <span>Welkom thuis op de Kastelenring</span>
        <nav class="utility-links" aria-label="Direct naar">
          <a href="https://www.sev-voetbal.nl/programma-fw" target="_blank" rel="noreferrer">Programma</a>
          <a href="https://www.sev-voetbal.nl/afgelastingen" target="_blank" rel="noreferrer">Afgelastingen</a>
          <a href="/organisatie-contact#contact">Contact</a>
        </nav>
      </div>
    </div>
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand" href="/" aria-label="SEV home">
          <img src="${assetPath("optimized/sev-logo-small.png")}" alt="SEV-logo, opgericht in 1962">
          <span class="brand__name"><strong>SEV</strong><small>Sport &amp; Vriendschap</small></span>
        </a>
        <nav class="main-nav" id="main-navigation" aria-label="Hoofdnavigatie">
          <a href="/"${current("home")}>Home</a>
          <a href="/nieuws"${current("news")}>Nieuws</a>
          <a href="https://www.sev-voetbal.nl/programma-fw" target="_blank" rel="noreferrer">Wedstrijden <span class="nav-external" aria-hidden="true">↗</span></a>
          <a href="https://www.sev-voetbal.nl/teams" target="_blank" rel="noreferrer">Teams <span class="nav-external" aria-hidden="true">↗</span></a>
          <a href="/clubzaken"${current("club")}>Clubzaken</a>
          <a href="https://sev-brandbook.vercel.app/" target="_blank" rel="noreferrer">Dit is SEV <span class="nav-external" aria-hidden="true">↗</span></a>
          <a href="https://www.passasports.nl/voetbal/clubshops/sev" target="_blank" rel="noreferrer">Clubshop <span class="nav-external" aria-hidden="true">↗</span></a>
          <a class="button nav-join" href="/lid-worden"${current("member")}>Nieuw bij SEV? <span class="button__arrow" aria-hidden="true">→</span></a>
        </nav>
        <div class="header-actions">
          <a class="button nav-join" href="/lid-worden"${current("member")}>Nieuw bij SEV? <span class="button__arrow">→</span></a>
          <button class="menu-button" type="button" aria-expanded="false" aria-controls="main-navigation" aria-label="Menu openen"><span></span></button>
        </div>
      </div>
    </header>`;
}

const footerTarget = document.querySelector("[data-site-footer]");
if (footerTarget) {
  footerTarget.outerHTML = `
    <footer class="site-footer">
      <div class="footer__top">
        <div class="footer__brand">
          <a class="brand" href="/">
            <img src="${assetPath("optimized/sev-logo-small.png")}" alt="">
            <span class="brand__name"><strong>SEV</strong><small>Sport &amp; Vriendschap</small></span>
          </a>
          <p class="footer__tagline">Eén club.<br>Een leven lang.</p>
        </div>
        <div class="footer__nav">
          <div class="footer__column">
            <h3>Snel naar</h3>
            ${pageLinks.map(([, href, label]) => `<a href="${href}">${label}</a>`).join("")}
            <a href="/organisatie-contact#contact">Contact</a>
            <a href="/veilig-bij-sev">Veilig bij SEV</a>
            <a href="/privacy">Privacy</a>
            <a href="https://sev-brandbook.vercel.app/" target="_blank" rel="noreferrer">Dit is SEV ↗</a>
            <a href="https://www.passasports.nl/voetbal/clubshops/sev" target="_blank" rel="noreferrer">Clubshop ↗</a>
          </div>
          <div class="footer__column">
            <h3>Kastelenring</h3>
            <span>Sportparkweg 4</span>
            <span>2263 SX Leidschendam</span>
            <a href="tel:+31703278972">070 327 89 72</a>
            <a href="mailto:secretarissev@gmail.com">secretarissev@gmail.com</a>
            <a href="https://www.google.com/maps/search/?api=1&amp;query=Sportparkweg+4%2C+2263+SX+Leidschendam" target="_blank" rel="noreferrer">Route ↗</a>
            <a href="https://www.instagram.com/sevvoetballeidschendam/" target="_blank" rel="noreferrer">Instagram ↗</a>
          </div>
        </div>
      </div>
      <div class="footer__bottom">
        <span>© <span data-current-year></span> Voetbalvereniging SEV</span>
        <span>Sport, plezier en vriendschap sinds 1962</span>
      </div>
    </footer>`;
}

document.querySelectorAll("[data-current-year]").forEach((element) => {
  element.textContent = new Date().getFullYear();
});

const siteHeader = document.querySelector(".site-header");
const updateHeaderHeight = () => document.documentElement.style.setProperty("--site-header-height", `${siteHeader?.offsetHeight || 74}px`);
updateHeaderHeight();
if (siteHeader && "ResizeObserver" in window) new ResizeObserver(updateHeaderHeight).observe(siteHeader);

const menuButton = document.querySelector(".menu-button");
const mainNav = document.querySelector(".main-nav");
let menuReturnFocus = null;
const setMenuOpen = (open) => {
  if (!menuButton) return;
  document.body.classList.toggle("nav-open", open);
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Menu sluiten" : "Menu openen");
  if (open) {
    menuReturnFocus = document.activeElement;
    const first = mainNav?.querySelector("a") || menuButton;
    first?.focus();
  } else {
    menuReturnFocus?.focus?.();
    menuReturnFocus = null;
  }
};
menuButton?.addEventListener("click", () => setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true"));
document.addEventListener("keydown", (event) => {
  if (!document.body.classList.contains("nav-open")) return;
  if (event.key === "Escape") {
    event.preventDefault();
    setMenuOpen(false);
    return;
  }
  if (event.key !== "Tab" || !mainNav) return;
  const focusable = [...mainNav.querySelectorAll("a, button"), menuButton].filter((el) => el && !el.hasAttribute("disabled") && el.getClientRects().length);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

window.matchMedia("(min-width: 1081px)").addEventListener("change", (event) => {
  if (event.matches && document.body.classList.contains("nav-open")) setMenuOpen(false);
});

document.querySelectorAll(".main-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    setMenuOpen(false);
  });
});

const revealObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12 })
  : null;

document.querySelectorAll(".reveal").forEach((element) => {
  if (revealObserver) revealObserver.observe(element);
  else element.classList.add("is-visible");
});

const newsLogo = assetPath("optimized/sev-logo-small.png");

function setNewsImage(image, src) {
  const usesLogo = src === newsLogo;
  image.src = src;
  image.alt = usesLogo ? "SEV-logo" : "";
  image.classList.toggle("news-card__image--logo", usesLogo);
}

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric"
});

function createNewsCard(item, index, featureFirst) {
  item = formatNewsForDisplay(item);
  const article = document.createElement("article");
  article.className = `news-card reveal is-visible${featureFirst && index === 0 ? " news-card--featured" : ""}`;
  article.dataset.search = `${item.title} ${item.excerpt} ${item.category}`.toLowerCase();

  const link = document.createElement("a");
  link.className = "news-card__link";
  link.href = item.link;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.setAttribute("aria-label", `${item.title} — opent op de huidige SEV-site`);

  const media = document.createElement("div");
  media.className = "news-card__media";
  const image = document.createElement("img");
  setNewsImage(image, normalizeNewsImage(item.image) || newsLogo);
  image.loading = index > 1 ? "lazy" : "eager";
  image.addEventListener("error", () => {
    setNewsImage(image, newsLogo);
  }, { once: true });
  const badge = document.createElement("span");
  badge.className = "news-card__badge";
  badge.textContent = item.category || "Clubnieuws";
  media.append(image, badge);

  const content = document.createElement("div");
  content.className = "news-card__content";
  const date = document.createElement("time");
  date.className = "news-card__date";
  if (item.date) {
    date.dateTime = item.date;
    date.textContent = dateFormatter.format(new Date(item.date));
  } else {
    date.textContent = "SEV nieuws";
  }
  const title = document.createElement("h3");
  title.textContent = item.title;
  const excerpt = document.createElement("p");
  excerpt.textContent = item.excerpt;
  const read = document.createElement("span");
  read.className = "news-card__read";
  read.textContent = "Lees het hele bericht ↗";
  content.append(date, title, excerpt, read);
  link.append(media, content);
  article.append(link);
  return article;
}

function newsStatusNote(payload, fromCache = false) {
  if (payload.dataStatus?.refreshing) return " · wordt bijgewerkt";
  if (payload.dataStatus?.stale) {
    const date = payload.dataStatus.sourceUpdatedAt;
    return date && !Number.isNaN(Date.parse(date))
      ? ` · bron gecontroleerd op ${dateFormatter.format(new Date(date))}` : " · laatst beschikbaar";
  }
  return fromCache ? " · eerder geladen" : "";
}

async function fetchNewsPayload(url, onPayload, attempt = 0) {
  const requestUrl = new URL(url, window.location.href);
  if (attempt) requestUrl.searchParams.set("_refresh", String(Date.now()));
  const response = await fetch(requestUrl, { headers: { Accept: "application/json" },
    cache: attempt ? "no-store" : "default", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Status ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.items)) throw new Error("Ongeldige nieuwsrespons");
  payload.items = dedupeNews(payload.items);
  onPayload(payload);
  if (payload.dataStatus?.refreshing && attempt < 4) {
    setTimeout(() => fetchNewsPayload(url, onPayload, attempt + 1).catch(() => {}), 3000 * (attempt + 1));
  }
  return payload;
}

async function loadLatestNews(grid) {
  const limit = Number(grid.dataset.limit || 6);
  const featureFirst = grid.dataset.featureFirst !== "false";
  const status = document.querySelector("[data-news-status]");
  const storageKey = `sev-news-latest-news-v3-${limit}`;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(storageKey) || "null"); } catch { cached = null; }
  grid.replaceChildren();
  if (Array.isArray(cached?.items) && cached.items.length) grid.append(...selectNewsKind(dedupeNews(cached.items)).map((item, index) => createNewsCard(item, index, featureFirst)));
  try {
    await fetchNewsPayload(`/api/news?limit=${limit}&kind=news`, (payload) => {
      if (!payload.items.length) throw new Error("Lege nieuwsfeed");
      grid.replaceChildren(...selectNewsKind(payload.items).map((item, index) => createNewsCard(item, index, featureFirst)));
      try { localStorage.setItem(storageKey, JSON.stringify(payload)); } catch {}
      if (status) status.textContent = newsStatusNote(payload).replace(/^ · /, "");
    });
  } catch {
    if (status) status.textContent = cached?.items?.length ? "Eerder geladen nieuws · bron tijdelijk niet bereikbaar" : "Nieuws tijdelijk niet bereikbaar. Bekijk alle berichten op sev-voetbal.nl.";
  }
}

function initNewsArchive(grid) {
  const newsType = grid.dataset.newsKind === "reports" ? "reports" : "news";
  const currentYear = new Date().getFullYear();
  const archiveYears = Array.from({ length: Math.max(1, currentYear - 2025 + 1) }, (_, index) => String(currentYear - index)).join(",");
  const perPage = Number(grid.dataset.pageSize || 18);
  const status = document.querySelector("[data-news-status]");
  const search = document.querySelector("[data-news-search]");
  const empty = document.querySelector("[data-news-empty]");
  const sentinel = document.querySelector("[data-news-sentinel]");
  const loadLabel = document.querySelector("[data-news-load-label]");
  const loadHint = document.querySelector("[data-news-load-hint]");
  const toolbar = document.querySelector("[data-news-toolbar]");
  const filterPanel = document.querySelector("[data-news-filters]");
  const filterToggle = document.querySelector("[data-news-filter-toggle]");
  const filterDone = document.querySelector("[data-news-filter-done]");
  const mobile = window.matchMedia("(max-width: 720px)");
  let filtersOpen = false;
  const clearButton = document.querySelector("[data-news-clear]");
  const summary = document.querySelector("[data-news-filter-summary]");
  const showAllButton = document.querySelector("[data-news-show-all]");
  const filterButtons = () => document.querySelectorAll("[data-filter-year], [data-filter-audience]");
  const urlState = new URLSearchParams(window.location.search);
  const state = {
    page: 0,
    hasMore: true,
    loading: false,
    requestId: 0,
    search: "",
    years: new Set(),
    audiences: new Set(),
    cache: new Map(),
    availableYears: [],
    error: false,
    items: [],
    total: 0,
    restoring: false
  };
  const viewId = history.state?.sevNewsView || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  const viewStorageKey = `sev-news-view-v3-${newsType}-${viewId}`;
  let restore = null;
  try { restore = readArchiveView(sessionStorage.getItem(viewStorageKey), {
    url: `${location.pathname}${location.search}`, perPage }); } catch {}
  history.replaceState({ ...history.state, sevNewsView: viewId }, "");

  const updateToolbarHeight = () => document.documentElement.style.setProperty("--news-toolbar-height", `${toolbar?.offsetHeight || 100}px`);
  if (toolbar && "ResizeObserver" in window) new ResizeObserver(updateToolbarHeight).observe(toolbar);
  function setFiltersOpen(open, { scroll = false, focus = false } = {}) {
    filtersOpen = open;
    if (filterPanel) {
      filterPanel.hidden = mobile.matches && !open;
      filterPanel.dataset.ready = "true";
    }
    filterToggle?.setAttribute("aria-expanded", String(!mobile.matches || open));
    if (scroll && open) filterPanel?.scrollIntoView({ block: "start", behavior: "smooth" });
    if (focus) filterToggle?.focus({ preventScroll: true });
  }
  filterToggle?.addEventListener("click", () => setFiltersOpen(!filtersOpen, { scroll: !filtersOpen }));
  filterDone?.addEventListener("click", () => {
    setFiltersOpen(false, { focus: true });
    grid.scrollIntoView({ block: "start", behavior: "smooth" });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobile.matches && filtersOpen && !document.body.classList.contains("nav-open")) {
      setFiltersOpen(false, { focus: true });
    }
  });
  mobile.addEventListener("change", () => setFiltersOpen(filtersOpen));
  setFiltersOpen(Boolean(restore?.filtersOpen));
  updateToolbarHeight();
  const archiveStorageKey = `sev-news-archive-v3-${newsType}-${archiveYears}`;
  try {
    const saved = JSON.parse(localStorage.getItem(archiveStorageKey) || "[]");
    if (Array.isArray(saved)) state.cache = new Map(saved.slice(-8));
  } catch {}

  const yearOptions = document.querySelector("[data-news-year-options]");
  const configuredYears = (archiveYears || "").split(",").map((year) => year.trim()).filter(Boolean);
  const renderYears = (years) => {
    const current = new Date().getFullYear();
    const available = [...new Set([...(years || []).map(String), ...configuredYears, ...Array.from({ length: Math.max(1, current - 2025 + 1) }, (_, index) => String(current - index))])];
    if (!yearOptions) return;
    const yearKey = available.filter((year) => Number(year) >= 2025).sort((a, b) => Number(b) - Number(a)).join(",");
    if (yearOptions.dataset.renderedYears === yearKey) return;
    yearOptions.dataset.renderedYears = yearKey;
    yearOptions.replaceChildren(...available.filter((year) => Number(year) >= 2025).sort((a, b) => Number(b) - Number(a)).map((year) => {
      const button = document.createElement("button");
      button.className = "news-filter";
      button.type = "button";
      button.dataset.filterYear = year;
      button.setAttribute("aria-pressed", "false");
      button.textContent = year;
      return button;
    }));
  };
  renderYears();

  const setFromQuery = (key, target) => (urlState.get(key) || "").split(",").map((v) => v.trim()).filter(Boolean).forEach((v) => target.add(v));
  state.search = urlState.get("search") || "";
  setFromQuery("years", state.years);
  setFromQuery("audiences", state.audiences);
  if (search) search.value = state.search;

  function syncUrl() {
    const params = new URLSearchParams(window.location.search);
    ["search", "years", "audiences"].forEach((key) => params.delete(key));
    if (state.search) params.set("search", state.search);
    if (state.years.size) params.set("years", [...state.years].join(","));
    if (state.audiences.size) params.set("audiences", [...state.audiences].join(","));
    const query = params.toString();
    history.replaceState({ ...history.state, sevNewsView: viewId }, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }

  const cacheKey = () => JSON.stringify([state.search, [...state.years].sort(), [...state.audiences].sort()]);

  function updateFilterUi() {
    filterButtons().forEach((button) => {
      const value = button.dataset.filterYear || button.dataset.filterAudience;
      const selected = button.dataset.filterYear ? state.years : state.audiences;
      const active = selected.has(value);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const count = state.years.size + state.audiences.size;
    if (summary) {
      const labels = { jeugd: "Jeugd", senioren: "Senioren", veteranen: "Veteranen", g: "G-voetbal", kleuters: "Peuters & kleuters", vrouwen: "Vrouwen", walking: "Walking Football" };
      summary.textContent = [...state.years, ...[...state.audiences].map((value) => labels[value] || value), ...(state.search ? [`“${state.search}”`] : [])].join(" · ") || "Alle berichten";
      summary.title = summary.textContent;
    }
    if (clearButton) clearButton.hidden = !count && !state.search;
    if (filterToggle) filterToggle.textContent = count ? `Filters (${count})` : "Filters";
  }

  function updateProgress() {
    const moreButton = document.querySelector("[data-news-load-more]");
    if (sentinel) sentinel.hidden = state.total === 0 && !state.loading && !state.error;
    if (loadLabel) loadLabel.textContent = formatNewsProgress(grid.children.length, state.total);
    if (loadHint) loadHint.textContent = state.hasMore ? "Scroll verder of laad meer" : "Alle berichten zijn zichtbaar";
    if (moreButton) moreButton.hidden = !state.hasMore && !state.error;
  }

  function saveView() {
    if (!state.page || !state.items.length || state.restoring) return;
    try {
      sessionStorage.setItem(viewStorageKey, JSON.stringify(createArchiveView({
        url: `${location.pathname}${location.search}`, perPage, items: state.items,
        page: state.page, total: state.total, hasMore: state.hasMore,
        scrollY: window.scrollY, filtersOpen
      })));
    } catch { /* Storage is optional; the live archive remains usable. */ }
  }
  window.addEventListener("pagehide", saveView);
  document.addEventListener("visibilitychange", () => { if (document.hidden) saveView(); });

  function renderCached() {
    const cached = state.cache.get(cacheKey());
    if (!cached) return false;
    grid.replaceChildren(...dedupeNews(cached.items).map((item, index) => createNewsCard(item, index, false)));
    state.items = dedupeNews(cached.items);
    state.total = cached.total;
    state.page = Math.max(1, Math.ceil(state.items.length / perPage));
    state.hasMore = state.items.length < cached.total;
    if (empty) empty.hidden = cached.total !== 0;
    if (status) status.textContent = `${cached.total} ${cached.total === 1 ? "bericht" : "berichten"} · eerder geladen`;
    updateProgress();
    return true;
  }

  async function loadArchivePage({ reset = false } = {}) {
    if (state.loading && !reset) return;
    if (reset) {
      state.requestId += 1;
      state.page = 0;
      state.hasMore = true;
      state.error = false;
      state.restoring = false;
      const cached = state.cache.get(cacheKey());
      state.items = dedupeNews(cached?.items || []).slice(0, perPage);
      state.total = cached?.total || 0;
      grid.replaceChildren(...state.items.map((item, index) => createNewsCard(item, index, false)));
      if (empty) empty.hidden = true;
      if (showAllButton) showAllButton.hidden = true;
    }

    const requestId = state.requestId;
    const requestCacheKey = cacheKey();
    const nextPage = state.page + 1;
    state.loading = true;
    const retryButton = document.querySelector("[data-news-load-more]");
    if (retryButton) retryButton.disabled = true;
    if (sentinel) sentinel.hidden = false;
    if (loadLabel) loadLabel.textContent = reset ? "Berichten ophalen…" : "Meer berichten laden…";
    if (status && reset) status.textContent = "Overzicht bijwerken…";

    const params = new URLSearchParams({
      years: archiveYears,
      page: String(nextPage),
      perPage: String(perPage)
    });
    params.set("kind", newsType);
    if (state.search) params.set("search", state.search);
    if (state.years.size) params.set("filterYears", [...state.years].join(","));
    if (state.audiences.size) params.set("audiences", [...state.audiences].join(","));

    try {
      await fetchNewsPayload(`/api/news?${params}`, (payload) => {
      if (requestId !== state.requestId || state.page > nextPage) return;
      state.error = false;
      if (Array.isArray(payload.availableYears)) renderYears(payload.availableYears);

      const startIndex = reset ? 0 : grid.children.length;
      const cards = payload.items.map((item, index) => createNewsCard(item, startIndex + index, false));
      if (reset) grid.replaceChildren(...cards);
      else {
        const existingLinks = new Set([...grid.querySelectorAll("a")].map((link) => link.href));
        grid.append(...cards.filter((card) => !existingLinks.has(card.querySelector("a").href)));
      }

      state.items = dedupeNews(reset ? payload.items : [...state.items, ...payload.items]);
      state.total = payload.total;

      state.page = payload.page;
      state.hasMore = Boolean(payload.hasMore);
      const key = requestCacheKey;
      const existing = state.cache.get(key);
      state.cache.set(key, { items: dedupeNews(reset ? payload.items : [...(existing?.items || []), ...payload.items]), total: payload.total });
      try { localStorage.setItem(archiveStorageKey, JSON.stringify([...state.cache].slice(-8))); } catch {}
      if (empty) empty.hidden = payload.total !== 0;
      if (status) status.textContent = `${payload.total} ${payload.total === 1 ? "bericht" : "berichten"}${newsStatusNote(payload) || " gevonden"}`;
      updateProgress();
      if (showAllButton) showAllButton.hidden = payload.total !== 0;
      updateFilterUi();
      saveView();
      });
    } catch {
      if (requestId !== state.requestId) return;
      state.error = true;
      if (renderCached()) {
        if (status) status.textContent = "Eerder geladen nieuws · live bron tijdelijk niet bereikbaar";
      } else if (status) status.textContent = "Nieuwsarchief tijdelijk niet bereikbaar";
      if (sentinel) sentinel.hidden = false;
      if (loadLabel) loadLabel.textContent = "Opnieuw proberen";
    } finally {
      if (requestId === state.requestId) {
        state.loading = false;
        const retryButton = document.querySelector("[data-news-load-more]");
        if (retryButton) retryButton.disabled = false;
        if (!state.error) updateProgress();
      }
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-year], [data-filter-audience]");
    if (!button || !document.body.contains(button)) return;
    const value = button.dataset.filterYear || button.dataset.filterAudience;
    const selected = button.dataset.filterYear ? state.years : state.audiences;
    if (selected.has(value)) selected.delete(value);
    else selected.add(value);
    syncUrl();
    updateFilterUi();
    loadArchivePage({ reset: true });
  });

  let searchTimer;
  search?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    state.requestId += 1;
    searchTimer = setTimeout(() => {
      state.search = search.value.trim();
      syncUrl();
      loadArchivePage({ reset: true });
    }, 350);
    state.search = search.value.trim();
    updateFilterUi();
  });

  clearButton?.addEventListener("click", () => {
    clearTimeout(searchTimer);
    state.search = "";
    state.years.clear();
    state.audiences.clear();
    if (search) search.value = "";
    syncUrl();
    updateFilterUi();
    loadArchivePage({ reset: true });
  });
  showAllButton?.addEventListener("click", () => {
    clearTimeout(searchTimer);
    state.search = "";
    state.years.clear();
    state.audiences.clear();
    if (search) search.value = "";
    syncUrl();
    updateFilterUi();
    loadArchivePage({ reset: true });
  });

  let archiveObserver = null;
  if (sentinel && "IntersectionObserver" in window) {
    archiveObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && state.hasMore && !state.loading && !state.error && !state.restoring) {
        loadArchivePage();
      }
    }, { rootMargin: "600px 0px" });
    archiveObserver.observe(sentinel);
  }

  const manualLoadMore = document.querySelector("[data-news-load-more]");
  manualLoadMore?.addEventListener("click", () => {
    const retry = state.error;
    state.error = false;
    loadArchivePage({ reset: retry });
  });
  updateFilterUi();

  if (restore) {
    state.items = restore.items;
    state.page = restore.page;
    state.total = restore.total;
    state.hasMore = restore.hasMore;
    state.restoring = true;
    grid.replaceChildren(...state.items.map((item, index) => createNewsCard(item, index, false)));
    state.cache.set(cacheKey(), { items: state.items, total: state.total });
    if (status) status.textContent = `${state.total} berichten · eerder geladen`;
    updateProgress();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.scrollTo({ top: restore.scrollY, behavior: "instant" });
      requestAnimationFrame(() => {
        state.restoring = false;
        // A restored position may already be near the next batch. Recheck it once.
        if (archiveObserver) {
          archiveObserver.unobserve(sentinel);
          archiveObserver.observe(sentinel);
        }
      });
    }));
  } else loadArchivePage({ reset: true });
}

document.querySelectorAll("[data-news-grid]").forEach((grid) => {
  if (grid.dataset.years) initNewsArchive(grid);
  else loadLatestNews(grid);
});

async function loadInvestmentNews(grid) {
  const limit = Number(grid.dataset.limit || 30);
  const pageSize = Number(grid.dataset.pageSize || 9);
  const status = document.querySelector("[data-investment-news-status]");
  const loadMore = document.querySelector("[data-investment-news-more]");
  const storageKey = `sev-investment-news-${limit}`;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(storageKey) || "null"); } catch { cached = null; }

  let activeMoreHandler = null;
  let wantedVisible = pageSize;
  const renderPayload = (payload, fromCache = false) => {
    if (activeMoreHandler) loadMore?.removeEventListener("click", activeMoreHandler);
    let visible = 0;
    const showNextItems = (count = pageSize) => {
      const nextItems = payload.items.slice(visible, visible + count);
      grid.append(...nextItems.map((item, index) => createNewsCard(item, visible + index, false)));
      visible += nextItems.length;
      wantedVisible = Math.max(pageSize, visible);
      if (loadMore) {
        const remaining = payload.items.length - visible;
        loadMore.hidden = remaining <= 0;
        loadMore.textContent = remaining > 0 ? `Meer berichten tonen (${remaining})` : "Alle berichten zijn zichtbaar";
      }
    };
    grid.replaceChildren();
    showNextItems(wantedVisible);
    activeMoreHandler = () => showNextItems();
    loadMore?.addEventListener("click", activeMoreHandler);
    if (status) status.textContent = `${payload.items.length} berichten${newsStatusNote(payload, fromCache)}`;
  };
  grid.replaceChildren();
  if (Array.isArray(cached?.items) && cached.items.length) renderPayload({ ...cached, items: dedupeNews(cached.items) }, true);
  try {
    await fetchNewsPayload(`/api/investering-news?limit=${limit}`, (payload) => {
      if (!payload.items.length) throw new Error("Lege nieuwsfeed");
      try { localStorage.setItem(storageKey, JSON.stringify(payload)); } catch {}
      renderPayload(payload);
    });
  } catch {
    if (status) status.textContent = cached?.items?.length ? "Eerder geladen selectie · live bron tijdelijk niet bereikbaar" : "Laatste selectie · live bron tijdelijk niet bereikbaar";
    if (loadMore && !cached?.items?.length) {
      loadMore.hidden = false;
      loadMore.textContent = "Opnieuw proberen";
      loadMore.addEventListener("click", () => loadInvestmentNews(grid), { once: true });
    }
  }
}

document.querySelectorAll("[data-investment-news-grid]").forEach(loadInvestmentNews);

const teamFilters = document.querySelectorAll("[data-team-filter]");
const emptyTitle = document.querySelector("[data-match-empty-title]");
const emptyCopy = document.querySelector("[data-match-empty-copy]");
teamFilters.forEach((button) => {
  button.addEventListener("click", () => {
    teamFilters.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    if (emptyTitle) emptyTitle.textContent = `${button.dataset.teamLabel}: het nieuwe programma volgt`;
    if (emptyCopy) emptyCopy.textContent = "Zodra Sportlink het seizoen 2026–2027 publiceert, verschijnen de wedstrijden hier automatisch per team.";
  });
});
