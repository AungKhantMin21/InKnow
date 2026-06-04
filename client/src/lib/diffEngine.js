import { diffLines } from "diff";

export const computeChanges = (baseContent, currentContent) => {
  if (!baseContent && !currentContent) return [];
  const parts = diffLines(baseContent || "", currentContent || "");
  return parts
    .filter((p) => p.value)
    .map((p, i) => ({
      id: `change-${i}`,
      type: p.added ? "added" : p.removed ? "removed" : "unchanged",
      content: p.value.replace(/\n$/, ""),
      lineCount: p.count || 1,
    }));
};
