export const MAX_LINKEDIN_IMAGES = 9;

export type MediaRow = { kind: "local" | "url"; ref: string };

export function mediaRowsFromPost(post: {
  media_json?: string | null;
  image_path?: string | null;
}): MediaRow[] {
  if (post.media_json) {
    try {
      const j = JSON.parse(post.media_json) as unknown;
      if (!Array.isArray(j)) return [];
      const out: MediaRow[] = [];
      for (const item of j) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        const kind = o.kind === "url" ? "url" : "local";
        const ref = typeof o.ref === "string" ? o.ref.trim() : "";
        if (ref) out.push({ kind, ref });
      }
      return out.slice(0, MAX_LINKEDIN_IMAGES);
    } catch {
      return [];
    }
  }
  if (post.image_path?.trim()) {
    return [{ kind: "local", ref: post.image_path.trim() }];
  }
  return [];
}

/** Matches server persistence: dual-write image_path when exactly one local file. */
export function persistMediaPayload(rows: MediaRow[]): {
  media_json: string | null;
  image_path: string | null;
} {
  const clean = rows
    .map((r) => ({
      kind: (r.kind === "url" ? "url" : "local") as "local" | "url",
      ref: r.ref.trim(),
    }))
    .filter((r) => r.ref)
    .slice(0, MAX_LINKEDIN_IMAGES);

  if (clean.length === 0) {
    return { media_json: null, image_path: null };
  }

  const media_json = JSON.stringify(clean);
  const oneLocal = clean.length === 1 && clean[0].kind === "local";
  return {
    media_json,
    image_path: oneLocal ? clean[0].ref : null,
  };
}
