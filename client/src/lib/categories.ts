/** Aligned with template / content library filters and PostDetail dropdown grouping */
export const CONTENT_CATEGORIES = [
  "Business",
  "Lead Magnet",
  "Storytelling",
  "Hacks",
  "Actu",
] as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

export const UNCLASSIFIED_LABEL = "Unclassified";

const ORDER = new Map<string, number>(CONTENT_CATEGORIES.map((c, i) => [c, i]));

export function compareCategoryGroup(a: string, b: string): number {
  if (a === UNCLASSIFIED_LABEL && b !== UNCLASSIFIED_LABEL) return 1;
  if (b === UNCLASSIFIED_LABEL && a !== UNCLASSIFIED_LABEL) return -1;
  const ia = ORDER.get(a) ?? 100;
  const ib = ORDER.get(b) ?? 100;
  if (ia !== ib) return ia - ib;
  return a.localeCompare(b, "en");
}
