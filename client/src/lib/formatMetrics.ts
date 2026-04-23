import type { Template } from "../stores/templates";
import { UNCLASSIFIED_LABEL } from "./categories";

export function formatCompactInt(n: number): string {
  const x = Math.max(0, Math.floor(Number(n) || 0));
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (x >= 1_000) return `${(x / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(x);
}

/** One line for native &lt;option&gt; labels: title + visible LinkedIn-style metrics */
export function formatTemplateOptionLine(t: Template): string {
  const imp = formatCompactInt(t.impressions ?? 0);
  const replies = formatCompactInt(t.comments ?? 0);
  const reposts = formatCompactInt(t.shares ?? 0);
  return `${t.name}  ·  ${imp} imp · ${replies} replies · ${reposts} reposts`;
}

export function contenuGroupLabel(c: { category: string | null }): string {
  return c.category?.trim() || UNCLASSIFIED_LABEL;
}

export function formatContenuOptionLine(c: { name: string; category: string | null; type: string | null }): string {
  const cat = c.category?.trim();
  const type = c.type?.trim() || "—";
  if (cat) return `${c.name}  ·  ${cat}  ·  ${type}`;
  return `${c.name}  ·  ${type}`;
}
