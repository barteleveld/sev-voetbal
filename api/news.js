import { getLatestNews, getNewsArchivePage, SOURCE_URL } from "../lib/news.mjs";

export default async function handler(request, response) {
  try {
    const archiveYears = request.query?.years;
    const limit = Number(request.query?.limit ?? 10);
    const archive = archiveYears ? await getNewsArchivePage({
      archiveYears,
      years: request.query?.filterYears,
      audiences: request.query?.audiences,
      search: request.query?.search,
      page: request.query?.page,
      perPage: request.query?.perPage
    }) : null;
    const items = archive ? archive.items : await getLatestNews(limit);
    response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
    response.status(200).json({
      source: SOURCE_URL,
      updatedAt: new Date().toISOString(),
      items,
      ...(archive || {})
    });
  } catch (error) {
    response.status(502).json({
      error: "Het actuele SEV-nieuws kon tijdelijk niet worden opgehaald.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}
