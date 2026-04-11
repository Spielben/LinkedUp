const API_ORIGINS = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);

/**
 * Use absolute URL to the Express API when the UI is not served from the same origin
 * (Vite dev :5173, vite preview, etc.). Production build opened on :3000 uses relative /api.
 * Override with VITE_API_ORIGIN in client/.env when needed.
 */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const configured = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, "");

  if (configured) {
    return `${configured}${p}`;
  }

  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    if (API_ORIGINS.has(origin)) {
      return p;
    }
    const h = window.location.hostname;
    const port = window.location.port;
    const isLoopback =
      h === "localhost" || h === "127.0.0.1" || h === "[::1]";
    // Vite dev/preview (:5173, :4173, …): API stays on :3000
    if (isLoopback && port !== "3000") {
      return `http://127.0.0.1:3000${p}`;
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
        `Cannot reach the API (${origin}). Open a terminal, cd into the linkdup project folder, run: npm run dev — the server must be listening on port 3000. If you use another host/port, set VITE_API_ORIGIN in client/.env (e.g. VITE_API_ORIGIN=http://localhost:3000).`
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
      "The app received a web page instead of API JSON. Run the backend on port 3000 (npm run dev from linkdup). If the UI is not on :3000, ensure the API is reachable; set VITE_API_ORIGIN in client/.env if it uses another URL."
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from API (${res.status}): ${text.slice(0, 160)}`);
  }
}
