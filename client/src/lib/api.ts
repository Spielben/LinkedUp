const API_ORIGINS = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);

/** LAN / machine-local hosts where the API is expected on the same hostname, port 3000 */
function isLikelyLocalDevHost(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  ) {
    return true;
  }
  if (hostname.endsWith(".local")) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  return false;
}

/**
 * Use absolute URL to Express (:3000) when the UI is on another port (Vite, preview, --host).
 * Same host as the page for LAN; override with VITE_API_ORIGIN in client/.env.
 */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const configured = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, "");

  if (configured) {
    return `${configured}${p}`;
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    const origin = window.location.origin;

    if (API_ORIGINS.has(origin)) {
      return p;
    }

    if (protocol === "file:" || !hostname) {
      return `http://127.0.0.1:3000${p}`;
    }

    const uiPort = port || (protocol === "https:" ? "443" : "80");
    const onDefaultApiPort = uiPort === "3000";

    if (isLikelyLocalDevHost(hostname) && !onDefaultApiPort) {
      return `${protocol}//${hostname}:3000${p}`;
    }

    return p;
  }

  if (import.meta.env.DEV) {
    return `http://127.0.0.1:3000${p}`;
  }
  return p;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = apiUrl(path);
  try {
    return await fetch(url, init);
  } catch (e) {
    let origin: string;
    try {
      origin = new URL(url).origin;
    } catch {
      origin = url;
    }
    if (e instanceof TypeError) {
      throw new Error(
        `Cannot reach the API (${origin}). From the linkdup project folder, run: npm run dev (API + Vite) — the API must be listening on port 3000. If you use another host/port, set VITE_API_ORIGIN in client/.env (e.g. VITE_API_ORIGIN=http://localhost:3000).`
      );
    }
    throw e;
  }
}

/** Parse JSON or throw a clear error if the server returned HTML (SPA fallback) or non-JSON. */
export async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) {
    throw new Error(
      "The app received a web page instead of API JSON. Run the stack from linkdup (npm run dev) so the API is on port 3000. If the UI is not on :3000, ensure the API is reachable; set VITE_API_ORIGIN in client/.env if it uses another URL."
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from API (${res.status}): ${text.slice(0, 160)}`);
  }
}
