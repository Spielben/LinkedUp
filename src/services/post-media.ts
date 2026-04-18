import fs from "node:fs";
import path from "node:path";

/** LinkedIn organic multi-image posts typically allow up to 9 images. */
export const MAX_LINKEDIN_IMAGES = 9;

/** Max bytes per image (fetch or read). */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export type MediaSourceKind = "local" | "url";

export interface MediaSource {
  kind: MediaSourceKind;
  ref: string;
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const m = h.match(ipv4);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }

  if (h.includes(":")) {
    const parts = h.split(":");
    const first = (parts[0] || "").toLowerCase();
    if (first === "fc" || first === "fd" || first === "fe") return true; // ULA / link-local IPv6
  }

  return false;
}

function validateMediaSources(items: unknown[]): MediaSource[] {
  const out: MediaSource[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const kind = (item as Record<string, unknown>).kind;
    const ref = (item as Record<string, unknown>).ref;
    if (kind !== "local" && kind !== "url") continue;
    if (typeof ref !== "string" || !ref.trim()) continue;
    out.push({ kind, ref: ref.trim() });
  }
  return out.slice(0, MAX_LINKEDIN_IMAGES);
}

/** Parse stored JSON; returns null if invalid or empty. */
export function parseMediaJson(raw: string | null | undefined): MediaSource[] | null {
  if (!raw || !raw.trim()) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return null;
    const sources = validateMediaSources(data);
    return sources.length > 0 ? sources : null;
  } catch {
    return null;
  }
}

/**
 * Media attached to a draft post: `media_json` if set, otherwise legacy `image_path`.
 */
export function getPostMediaSources(post: {
  media_json?: string | null;
  image_path?: string | null;
}): MediaSource[] {
  const fromJson = parseMediaJson(post.media_json ?? null);
  if (fromJson) return fromJson;
  const legacy = post.image_path?.trim();
  if (legacy) return [{ kind: "local", ref: legacy }];
  return [];
}

function resolveLocalMediaPath(ref: string, cwd: string): string {
  const resolved = path.isAbsolute(ref) ? path.normalize(ref) : path.resolve(cwd, ref);

  if (path.isAbsolute(ref)) {
    return resolved;
  }

  const dataRoot = path.resolve(cwd, "data");
  const prefix = dataRoot.endsWith(path.sep) ? dataRoot : dataRoot + path.sep;
  if (resolved !== dataRoot && !resolved.startsWith(prefix)) {
    throw new Error("Relative local media paths must be under the project data/ folder");
  }
  return resolved;
}

export async function resolveMediaSourceToBuffer(source: MediaSource, cwd: string): Promise<Buffer> {
  if (source.kind === "url") {
    let u: URL;
    try {
      u = new URL(source.ref);
    } catch {
      throw new Error("Invalid media URL");
    }
    if (u.protocol !== "https:") {
      throw new Error("Only https:// URLs are allowed for remote media");
    }
    if (isPrivateOrLocalHostname(u.hostname)) {
      throw new Error("That URL host is not allowed (private / local addresses blocked)");
    }

    const res = await fetch(source.ref, {
      redirect: "follow",
      headers: { Accept: "image/*,*/*" },
    });
    if (!res.ok) {
      throw new Error(`Could not download media (${res.status})`);
    }
    const lenHeader = res.headers.get("content-length");
    if (lenHeader) {
      const n = Number(lenHeader);
      if (Number.isFinite(n) && n > MAX_IMAGE_BYTES) {
        throw new Error("Remote image is too large");
      }
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("Remote image is too large");
    }
    return Buffer.from(ab);
  }

  const filePath = resolveLocalMediaPath(source.ref, cwd);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Media file not found: ${source.ref}`);
  }
  const st = fs.statSync(filePath);
  if (!st.isFile()) {
    throw new Error("Media path is not a file");
  }
  if (st.size > MAX_IMAGE_BYTES) {
    throw new Error("Local image file is too large");
  }
  return fs.readFileSync(filePath);
}

export async function resolveAllMediaSources(sources: MediaSource[], cwd: string): Promise<Buffer[]> {
  const buffers: Buffer[] = [];
  for (const s of sources) {
    buffers.push(await resolveMediaSourceToBuffer(s, cwd));
  }
  return buffers;
}
