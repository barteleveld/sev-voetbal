import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { getLatestNews, getNewsByYears, SOURCE_URL } from "./lib/news.mjs";
import { getInvestmentNews, SOURCE_URL as INVESTMENT_SOURCE_URL } from "./lib/investment-news.mjs";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function send(response, status, body, type = "text/plain; charset=utf-8") {
  const isTextAsset = /^(text\/(html|css|javascript)|application\/json)/.test(type);
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": isTextAsset ? "no-cache" : "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  });
  response.end(body);
}

const cleanRoutes = new Map([
  ["/", "index.html"],
  ["/nieuws", "nieuws.html"],
  ["/wedstrijden", "wedstrijden.html"],
  ["/lid-worden", "lid-worden.html"],
  ["/clubzaken", "clubzaken.html"],
  ["/lidmaatschap", "lidmaatschap.html"],
  ["/veilig-bij-sev", "veilig-bij-sev.html"],
  ["/organisatie-contact", "organisatie-contact.html"],
  ["/privacy", "privacy.html"],
  ["/de-investering", "de-investering.html"]
]);

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/api/news") {
    try {
      const years = url.searchParams.get("years");
      const items = years
        ? await getNewsByYears(years)
        : await getLatestNews(url.searchParams.get("limit"));
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300"
      });
      response.end(JSON.stringify({ source: SOURCE_URL, updatedAt: new Date().toISOString(), items }));
    } catch (error) {
      send(
        response,
        502,
        JSON.stringify({ error: "Nieuwsbron tijdelijk niet bereikbaar", detail: error.message }),
        "application/json; charset=utf-8"
      );
    }
    return;
  }

  if (url.pathname === "/api/investering-news") {
    try {
      const items = await getInvestmentNews(url.searchParams.get("limit"));
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=900"
      });
      response.end(JSON.stringify({ source: INVESTMENT_SOURCE_URL, updatedAt: new Date().toISOString(), items }));
    } catch (error) {
      send(
        response,
        502,
        JSON.stringify({ error: 'Nieuws over Club van 50 "De InVESTEring" tijdelijk niet bereikbaar', detail: error.message }),
        "application/json; charset=utf-8"
      );
    }
    return;
  }

  const requested = cleanRoutes.get(url.pathname) || url.pathname.slice(1);
  const safePath = normalize(requested).replace(/^(\.\.(\\|\/|$))+/, "");
  const blocked = /^(api|lib)(\\|\/)|^(server\.mjs|package(?:-lock)?\.json|vercel\.json)$/i.test(safePath);

  if (!safePath || blocked) {
    send(response, 404, "Niet gevonden");
    return;
  }

  try {
    const file = await readFile(join(ROOT, safePath));
    send(response, 200, file, mimeTypes[extname(safePath).toLowerCase()] || "application/octet-stream");
  } catch {
    send(response, 404, "Niet gevonden");
  }
}).listen(PORT, () => {
  console.log(`SEV clubsite-concept draait op http://localhost:${PORT}`);
});
