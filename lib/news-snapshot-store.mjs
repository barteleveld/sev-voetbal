import { dedupeNews } from "../news-utils.js";

export function mergeCompleteSnapshot(previous, candidate) {
  if (!candidate.complete || !candidate.items?.length) {
    throw new Error("Onvolledige broncontrole: de opgeslagen nieuwsindex blijft ongewijzigd");
  }
  return { ...candidate, items: dedupeNews([...(previous.items || []), ...candidate.items]) };
}
