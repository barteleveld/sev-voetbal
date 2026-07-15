const page = document.body.dataset.page || "home";
const scriptUrl = document.currentScript?.src || document.baseURI;
const assetBase = new URL("assets/", scriptUrl);
const assetPath = (path) => new URL(path.replace(/^assets\//, ""), assetBase).href;
const pageLinks = [
  ["home", "/", "Home"],
  ["news", "/nieuws", "Nieuws"],
  ["matches", "/wedstrijden", "Wedstrijden"],
  ["member", "/lid-worden", "Nieuw bij SEV"]
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
          <a href="/wedstrijden">Programma</a>
          <a href="https://www.sev-voetbal.nl/afgelastingen" target="_blank" rel="noreferrer">Afgelastingen</a>
          <a href="mailto:secretarissev@gmail.com">Contact</a>
        </nav>
      </div>
    </div>
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand" href="/" aria-label="SEV home">
          <img src="${assetPath("sev-logo.png")}" alt="SEV-logo, opgericht in 1962">
          <span class="brand__name"><strong>SEV</strong><small>Sport &amp; Vriendschap</small></span>
        </a>
        <nav class="main-nav" id="main-navigation" aria-label="Hoofdnavigatie">
          <a href="/"${current("home")}>Home</a>
          <a href="/nieuws"${current("news")}>Nieuws</a>
          <a href="/wedstrijden"${current("matches")}>Wedstrijden</a>
          <a href="https://www.sev-voetbal.nl/jeugdvoetbal/" target="_blank" rel="noreferrer">Teams</a>
          <a href="/lid-worden"${current("member")}>Nieuw bij SEV</a>
          <a href="https://sev-brandbook.vercel.app/" target="_blank" rel="noreferrer">Dit is SEV</a>
        </nav>
        <div class="header-actions">
          <a class="button" href="/lid-worden"${current("member")}>Nieuw bij SEV <span class="button__arrow">→</span></a>
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
            <img src="${assetPath("sev-logo.png")}" alt="">
            <span class="brand__name"><strong>SEV</strong><small>Sport &amp; Vriendschap</small></span>
          </a>
          <p class="footer__tagline">Eén club.<br>Een leven lang.</p>
        </div>
        <div class="footer__nav">
          <div class="footer__column">
            <h3>Snel naar</h3>
            ${pageLinks.map(([, href, label]) => `<a href="${href}">${label}</a>`).join("")}
            <a href="https://sev-brandbook.vercel.app/" target="_blank" rel="noreferrer">Dit is SEV ↗</a>
            <a href="https://www.passasports.nl/voetbal/clubshops/sev" target="_blank" rel="noreferrer">Clubshop ↗</a>
          </div>
          <div class="footer__column">
            <h3>Kastelenring</h3>
            <span>Sportparkweg 4</span>
            <span>2263 SX Leidschendam</span>
            <a href="tel:+31703278972">070 327 89 72</a>
            <a href="mailto:secretarissev@gmail.com">secretarissev@gmail.com</a>
            <a href="https://www.instagram.com/sevvoetballeidschendam/" target="_blank" rel="noreferrer">Instagram ↗</a>
          </div>
        </div>
      </div>
      <div class="footer__bottom">
        <span>© <span data-current-year></span> Voetbalvereniging SEV</span>
        <span>Sport, plezier en vriendschap sinds 1962 · Live nieuws van sev-voetbal.nl</span>
      </div>
    </footer>`;
}

document.querySelectorAll("[data-current-year]").forEach((element) => {
  element.textContent = new Date().getFullYear();
});

const menuButton = document.querySelector(".menu-button");
menuButton?.addEventListener("click", () => {
  const open = document.body.classList.toggle("nav-open");
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Menu sluiten" : "Menu openen");
});

document.querySelectorAll(".main-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    document.body.classList.remove("nav-open");
    menuButton?.setAttribute("aria-expanded", "false");
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

const newsLogo = assetPath("sev-logo.png");
const newsImageMatches = [
  { pattern: /\bkampioen(?:en|schap)?\b/i, src: assetPath("nieuwsarchief/images-blogpost-JO12-kampioen1.jpg") },
  { pattern: /\bvrijwilliger(?:s|savond)?\b/i, src: assetPath("nieuwsarchief/images-blogpost-vrijwilligersavond-2026-2.jpg") },
  { pattern: /\b(?:meiden|meisjes|vrouwen|dames)(?:team|voetbal)?\b/i, src: assetPath("nieuwsarchief/Meidenteam-vlak-na-de-eerste-wedstrijd.jpeg") },
  { pattern: /\b(?:buurtresto|buurtrestaurant)\b/i, src: assetPath("nieuwsarchief/buurtrestro_20260618_5.jpeg") },
  { pattern: /\bkleuter(?:s|training)?\b/i, src: assetPath("nieuwsarchief/images-blogpost-afsluiting-kleintjes3.jpg") },
  { pattern: /\bg[- ]?voetbal\b/i, src: assetPath("nieuwsarchief/G-trainers-in-het-zonnetje-2.jpg") }
];

function matchedNewsImage(item) {
  const text = `${item.title || ""} ${item.excerpt || ""} ${item.category || ""}`;
  return newsImageMatches.find(({ pattern }) => pattern.test(text))?.src || newsLogo;
}

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
  const sourceHasGenericImage = /thumbnail-algemeen|cropped-logo|logo-512/i.test(item.image || "");
  const fallbackImage = matchedNewsImage(item);
  setNewsImage(image, !sourceHasGenericImage && item.image ? item.image : fallbackImage);
  image.loading = index > 1 ? "lazy" : "eager";
  image.addEventListener("error", () => {
    setNewsImage(image, fallbackImage);
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

function bindNewsSearch() {
  const search = document.querySelector("[data-news-search]");
  if (!search || search.dataset.bound) return;
  search.dataset.bound = "true";
  search.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    document.querySelectorAll("[data-news-grid] .news-card").forEach((card) => {
      card.hidden = Boolean(query && !card.dataset.search?.includes(query));
    });
  });
}

async function loadNews(grid) {
  const limit = Number(grid.dataset.limit || 6);
  const featureFirst = grid.dataset.featureFirst !== "false";
  const status = document.querySelector("[data-news-status]");
  try {
    const response = await fetch(`/api/news?limit=${limit}`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.items) || !payload.items.length) throw new Error("Lege nieuwsfeed");
    grid.replaceChildren(...payload.items.map((item, index) => createNewsCard(item, index, featureFirst)));
    if (status) {
      const time = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(new Date(payload.updatedAt));
      status.textContent = `Live bijgewerkt om ${time}`;
    }
  } catch {
    if (status) status.textContent = "Reserveweergave · bron tijdelijk niet bereikbaar";
  }
  bindNewsSearch();
}

document.querySelectorAll("[data-news-grid]").forEach(loadNews);
bindNewsSearch();

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
