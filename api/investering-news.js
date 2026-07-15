import { getInvestmentNews, SOURCE_URL } from "../lib/investment-news.mjs";

export default async function handler(request, response) {
  try {
    const limit = Number(request.query?.limit ?? 30);
    const items = await getInvestmentNews(limit);
    response.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
    response.status(200).json({
      source: SOURCE_URL,
      updatedAt: new Date().toISOString(),
      items
    });
  } catch (error) {
    response.status(502).json({
      error: 'Het nieuws over Club van 50 "De InVESTEring" kon tijdelijk niet worden opgehaald.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}
