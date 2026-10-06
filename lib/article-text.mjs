import { load } from "cheerio";

// Use the real article container, not menus, related stories or footer widgets.
// A DOM parser is necessary: inline scripts on the old site contain HTML strings
// which make a regex-based count of nested <div> elements unreliable.
function articleRoot(html) {
  const $ = load(html);
  const selectors = [".nxs-article-container", ".entry-content, .article-content, .post-content, .single-content",
    "article", "main", "#nxs-content"];
  const root = selectors.map((selector) => $(selector).first()).find((node) => node.length);
  if (!root) return null;
  root.find("nav, header, footer, aside, form, script, style, .nxs-sidebar, .nxs-unistyle-mainmenu").remove();
  root.find("p, div, li, h1, h2, h3, h4, h5, h6, section, br").append(" ");
  return root;
}

export function extractArticleHtml(html = "") {
  return articleRoot(html)?.html() || "";
}

export function extractArticleText(html = "") {
  // Inline markup must not create artificial spaces (e.g. 14<sup>e</sup>).
  return (articleRoot(html)?.text() || "").replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1").trim();
}
