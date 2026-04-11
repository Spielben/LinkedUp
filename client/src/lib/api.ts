/**
 * In Vite dev the UI runs on :5173 (or similar) while Express serves the API on :3000.
 * Relative `/api` requests can fall through to index.html (invalid JSON). In dev we call the API origin explicitly.
 * Set VITE_API_ORIGIN in `.env` if your backend uses another host/port.
 */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (import.meta.env.DEV) {
    const raw = import.meta.env.VITE_API_ORIGIN as string | undefined;
    const base = (raw?.replace(/\/$/, "") || "http://127.0.0.1:3000");
    return `${base}${p}`;
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
      "The app received a web page instead of API data. Start the backend (npm run dev, port 3000) or check VITE_API_ORIGIN."
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from API (${res.status}): ${text.slice(0, 160)}`);
  }
}
