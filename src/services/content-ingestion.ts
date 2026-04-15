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
  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; LINKDUP/1.0; +http://localhost:3000)",
    },
  });

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
