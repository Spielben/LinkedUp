import * as cheerio from "cheerio";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import mammoth from "mammoth";

const DATA_DIRNAME = "data";

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, nav, header, footer, aside, [role='navigation'], [role='banner'], [role='contentinfo'], .nav, .menu, .sidebar, .advertisement, .ads").remove();

  const mainSelectors = ["main", "article", "[role='main']", ".content", "#content", ".post-content", ".article-body"];
  let text = "";
  for (const selector of mainSelectors) {
    const el = $(selector);
    if (el.length > 0) {
      text = el.text();
      break;
    }
  }

  if (!text.trim()) {
    text = $("body").text();
  }
  return normalizeText(text);
}

function assertSafeDataPath(filePath: string, cwd = process.cwd()): string {
  if (!filePath?.trim()) {
    throw new Error("No file path provided for ingestion");
  }
  const resolved = path.isAbsolute(filePath) ? path.normalize(filePath) : path.resolve(cwd, filePath);
  const dataRoot = path.resolve(cwd, DATA_DIRNAME);
  const prefix = dataRoot.endsWith(path.sep) ? dataRoot : `${dataRoot}${path.sep}`;

  if (resolved !== dataRoot && !resolved.startsWith(prefix)) {
    throw new Error("Invalid file path: only files under data/ are allowed");
  }
  if (!existsSync(resolved)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return resolved;
}

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  const pdfParseModule = await import("pdf-parse");
  const maybeLegacyFn =
    (pdfParseModule as unknown as { default?: (value: Buffer) => Promise<{ text: string }> }).default
    ?? (pdfParseModule as unknown as { parse?: (value: Buffer) => Promise<{ text: string }> }).parse;

  if (typeof maybeLegacyFn === "function") {
    const data = await maybeLegacyFn(buffer);
    return normalizeText(data.text);
  }

  const PDFParseCtor = (pdfParseModule as unknown as { PDFParse?: new (options: { data: Buffer }) => { getText: () => Promise<{ text: string }> } }).PDFParse;
  if (typeof PDFParseCtor === "function") {
    const parser = new PDFParseCtor({ data: buffer });
    const result = await parser.getText();
    return normalizeText(result.text || "");
  }

  throw new Error("Unsupported pdf-parse module shape");
}

function isGoogleHost(url: URL): boolean {
  return url.hostname === "drive.google.com" || url.hostname === "docs.google.com";
}

function isGoogleAuthOrViewerPage(body: string): boolean {
  const lower = body.toLowerCase();
  return (
    lower.includes("accounts.google.com") ||
    lower.includes("serviceLogin".toLowerCase()) ||
    lower.includes("signinchooser".toLowerCase())
  );
}

export function transformGoogleDriveUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const href = `${url.origin}${url.pathname}`;
  const docMatch = href.match(/^https:\/\/docs\.google\.com\/document\/d\/([^/]+)/i);
  if (docMatch) return `https://docs.google.com/document/d/${docMatch[1]}/export?format=txt`;

  const slideMatch = href.match(/^https:\/\/docs\.google\.com\/presentation\/d\/([^/]+)/i);
  if (slideMatch) return `https://docs.google.com/presentation/d/${slideMatch[1]}/export/txt`;

  const sheetMatch = href.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([^/]+)/i);
  if (sheetMatch) return `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=csv`;

  const driveMatch = href.match(/^https:\/\/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (driveMatch) return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;

  return null;
}

const WEB_FETCH_TIMEOUT_MS = 45_000;

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const WEB_FETCH_HEADERS: Record<string, string> = {
  "User-Agent": BROWSER_USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr,fr-FR;q=0.9,en-US,en;q=0.8",
};

function isIPv4DottedDecimal(host: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  const parts = host.split(".").map((x) => Number.parseInt(x, 10));
  return parts.length === 4 && parts.every((n) => n >= 0 && n <= 255);
}

/** Reject loopback, private, and link-local literal IPv4 (SSRF hardening for direct IPs). */
function isPrivateOrLoopbackIPv4(host: string): boolean {
  const parts = host.split(".").map((x) => Number.parseInt(x, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b, _c, _d] = parts;
  if (a === 0 || a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/** Block obvious non-public targets (hostname or literal IP). Full DNS-SSRF hardening is not covered. */
function assertPublicHttpUrl(u: URL): void {
  const raw = u.hostname;
  if (!raw) throw new Error("URL has no host");

  const host = raw.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("This URL cannot be used for web ingest (local host is not allowed).");
  }

  const unbracketed = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (unbracketed === "::1" || (unbracketed.includes(":") && (unbracketed.toLowerCase().startsWith("fe80:") || /^f[cd][0-9a-f]{2}:/i.test(unbracketed)))) {
    throw new Error("This URL cannot be used for web ingest (local or private address is not allowed).");
  }
  if (isIPv4DottedDecimal(unbracketed) && isPrivateOrLoopbackIPv4(unbracketed)) {
    throw new Error("This URL cannot be used for web ingest (private or loopback address is not allowed).");
  }
}

function formatFetchNetworkError(err: unknown): string {
  if (err === null || err === undefined) return "Unknown error while fetching the URL";
  if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
    return `Request timed out after ${WEB_FETCH_TIMEOUT_MS / 1000}s while fetching the URL`;
  }
  const base = err instanceof Error ? err.message : String(err);
  if (!(err instanceof Error) || err.cause === undefined) {
    return base;
  }
  const c = err.cause;
  if (c instanceof Error) {
    return `${base}: ${c.message}`;
  }
  if (typeof c === "object" && c !== null && "code" in c) {
    const code = String((c as NodeJS.ErrnoException).code ?? "");
    const msg = c instanceof Error ? c.message : String(c);
    return code ? `${base}: ${code} — ${msg}` : `${base}: ${msg}`;
  }
  return `${base}: ${String(c)}`;
}

export async function fetchWebContent(url: string): Promise<string> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new Error("Only http(s) URLs are supported");
  }

  const transformed = transformGoogleDriveUrl(url);
  const targetUrl = transformed ?? url;

  let finalUrl: URL;
  try {
    finalUrl = new URL(targetUrl);
  } catch {
    throw new Error(`Invalid target URL: ${targetUrl}`);
  }
  assertPublicHttpUrl(finalUrl);

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      headers: WEB_FETCH_HEADERS,
      signal: AbortSignal.timeout(WEB_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(formatFetchNetworkError(err));
  }

  if ((response.status === 401 || response.status === 403) && transformed) {
    throw new Error("Document Google Drive non public. Partagez-le en lecture publique ou telechargez-le et uploadez le fichier.");
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch URL (${response.status}): ${targetUrl}`);
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/pdf")) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return parsePdfBuffer(buffer).then((text) => text.slice(0, 50_000));
  }
  if (contentType.includes("text/csv")) {
    const csvText = await response.text();
    return normalizeText(csvText).slice(0, 50_000);
  }

  const html = await response.text();
  if (transformed && isGoogleHost(new URL(targetUrl)) && isGoogleAuthOrViewerPage(html)) {
    throw new Error("Document Google Drive non public. Partagez-le en lecture publique ou telechargez-le et uploadez le fichier.");
  }

  return htmlToText(html).slice(0, 50_000);
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function fetchYouTubeTranscript(url: string): Promise<string> {
  const videoId = extractYouTubeId(url);
  if (!videoId) throw new Error(`Could not extract YouTube video ID from: ${url}`);

  const { YoutubeTranscript } = await import("youtube-transcript");
  const segments = await YoutubeTranscript.fetchTranscript(videoId);
  return segments.map((s: { text: string }) => s.text).join(" ").replace(/\s+/g, " ").trim();
}

export async function fetchPdfContent(filePath: string): Promise<string> {
  const safePath = assertSafeDataPath(filePath);
  const buffer = readFileSync(safePath);
  return parsePdfBuffer(buffer);
}

export async function extractFileContent(filePath: string): Promise<string> {
  const safePath = assertSafeDataPath(filePath);
  const ext = path.extname(safePath).toLowerCase();

  if (ext === ".pdf") return fetchPdfContent(safePath);
  if (ext === ".txt" || ext === ".md") {
    return normalizeText(readFileSync(safePath, "utf-8"));
  }
  if (ext === ".html" || ext === ".htm") {
    const html = readFileSync(safePath, "utf-8");
    return htmlToText(html);
  }
  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: safePath });
    return normalizeText(result.value || "");
  }

  throw new Error(`Unsupported file format: ${ext || "unknown"}`);
}
