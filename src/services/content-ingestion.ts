import * as cheerio from "cheerio";
import { YoutubeTranscript } from "youtube-transcript";
import * as pdfParseModule from "pdf-parse";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> = (pdfParseModule as any).default ?? pdfParseModule;
import { readFileSync } from "fs";

export async function fetchWebContent(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; LINKDUP/1.0; +http://localhost:3000)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL (${response.status}): ${url}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove noise elements
  $("script, style, nav, header, footer, aside, [role='navigation'], [role='banner'], [role='contentinfo'], .nav, .menu, .sidebar, .advertisement, .ads").remove();

  // Try to get main content first
  const mainSelectors = ["main", "article", "[role='main']", ".content", "#content", ".post-content", ".article-body"];
  let text = "";

  for (const selector of mainSelectors) {
    const el = $(selector);
    if (el.length > 0) {
      text = el.text();
      break;
    }
  }

  // Fallback to body
  if (!text.trim()) {
    text = $("body").text();
  }

  // Normalize whitespace
  return text.replace(/\s+/g, " ").trim().slice(0, 50_000);
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

  const segments = await YoutubeTranscript.fetchTranscript(videoId);
  return segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
}

export async function fetchPdfContent(filePath: string): Promise<string> {
  const buffer = readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text.replace(/\s+/g, " ").trim();
}
