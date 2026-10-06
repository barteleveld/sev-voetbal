import { getLatestNews, getLatestNewsMeta, getNewsArchiveMeta, getNewsArchivePage, SOURCE_URL } from "../lib/news.mjs";
import { waitUntil } from "@vercel/functions";

export const config = { maxDuration: 120 };

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
      perPage: request.query?.perPage,
      kind: request.query?.kind,
      waitUntil
    }) : null;
    const items = archive ? archive.items : await getLatestNews(limit, { waitUntil, kind: request.query?.kind });
    const dataStatus = archive ? getNewsArchiveMeta() : getLatestNewsMeta();
    response.setHeader("Cache-Control", dataStatus.stale || dataStatus.refreshing
      ? "no-store" : "s-maxage=60, stale-while-revalidate=300");
    response.status(200).json({
      source: SOURCE_URL,
      updatedAt: new Date().toISOString(),
      dataStatus,
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
