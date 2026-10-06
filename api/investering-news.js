import { getInvestmentNews, getInvestmentNewsMeta, SOURCE_URL } from "../lib/investment-news.mjs";
import { waitUntil } from "@vercel/functions";

export const config = { maxDuration: 120 };

export default async function handler(request, response) {
  try {
    const limit = Number(request.query?.limit ?? 30);
    const items = await getInvestmentNews(limit, { waitUntil });
    const dataStatus = getInvestmentNewsMeta();
    response.setHeader("Cache-Control", dataStatus.stale || dataStatus.refreshing
      ? "no-store" : "s-maxage=60, stale-while-revalidate=300");
    response.status(200).json({
      source: SOURCE_URL,
      updatedAt: new Date().toISOString(),
      dataStatus,
      items
    });
  } catch (error) {
    response.status(502).json({
      error: 'Het nieuws over Club van 50 "De InVESTEring" kon tijdelijk niet worden opgehaald.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}
