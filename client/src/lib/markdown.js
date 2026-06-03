import { marked } from "marked";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
});

export const markdownToHtml = (markdown) => marked.parse(markdown || "");

export const htmlToMarkdown = (html) => turndown.turndown(html);
