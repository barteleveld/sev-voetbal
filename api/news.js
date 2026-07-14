import { getLatestNews, SOURCE_URL } from "../lib/news.mjs";

export default async function handler(request, response) {
  try {
    const limit = Number(request.query?.limit ?? 10);
    const items = await getLatestNews(limit);
    response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
    response.status(200).json({
      source: SOURCE_URL,
      updatedAt: new Date().toISOString(),
      items
    });
  } catch (error) {
    response.status(502).json({
      error: "Het actuele SEV-nieuws kon tijdelijk niet worden opgehaald.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}
