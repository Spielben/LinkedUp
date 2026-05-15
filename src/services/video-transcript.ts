import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { getCredential } from "../credentials.js";
import { getDataDir } from "../db/index.js";
import { assertPublicHttpUrl } from "./content-ingestion.js";

const execFileAsync = promisify(execFile);

const YT_DLP_TIMEOUT_MS = 180_000;
const ASSEMBLY_POLL_INTERVAL_MS = 3000;
const ASSEMBLY_POLL_MAX_ROUNDS = 120;

/** True for TikTok, Facebook/Instagram video, Vimeo, Dailymotion, X/Twitter video — not YouTube (handled separately). */
export function isThirdPartyVideoIngestUrl(urlStr: string): boolean {
  const t = urlStr.trim();
  if (!t) return false;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "youtu.be" || h.includes("youtube.com")) return false;
  if (h.includes("tiktok.com")) return true;
  if (h.includes("facebook.com") || h === "fb.watch" || h.includes("fb.watch")) return true;
  if (h.includes("instagram.com")) return true;
  if (h.includes("vimeo.com")) return true;
  if (h.includes("dailymotion.com") || h === "dai.ly") return true;
  if (h.includes("twitter.com") || h === "x.com") return true;
  return false;
}

interface AssemblyTranscriptJson {
  status?: string;
  text?: string;
  error?: string;
}

async function assemblyUpload(apiKey: string, filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const res = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/octet-stream",
    },
    body: buf,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AssemblyAI upload failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { upload_url?: string };
  if (!data.upload_url) throw new Error("AssemblyAI upload: no upload_url in response");
  return data.upload_url;
}

async function assemblyCreateJob(apiKey: string, audioUrl: string): Promise<string> {
  const res = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      speech_model: "universal-2",
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AssemblyAI transcript create failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("AssemblyAI: no transcript id");
  return data.id;
}

async function assemblyPollUntilDone(apiKey: string, transcriptId: string): Promise<string> {
  for (let i = 0; i < ASSEMBLY_POLL_MAX_ROUNDS; i++) {
    const res = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: { authorization: apiKey },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AssemblyAI poll failed (${res.status}): ${t.slice(0, 200)}`);
    }
    const data = (await res.json()) as AssemblyTranscriptJson;
    if (data.status === "completed") {
      const text = (data.text || "").trim();
      if (!text) throw new Error("AssemblyAI returned empty transcript");
      return text;
    }
    if (data.status === "error") {
      throw new Error(data.error || "AssemblyAI transcription error");
    }
    await new Promise((r) => setTimeout(r, ASSEMBLY_POLL_INTERVAL_MS));
  }
  throw new Error("AssemblyAI transcription timed out");
}

/**
 * Download audio with yt-dlp, transcribe with AssemblyAI (full spoken word).
 * Caller must ensure URL is a supported public video page.
 */
export async function fetchVideoTranscriptAssembly(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error(`Invalid video URL: ${url}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http(s) video URLs are supported");
  }
  assertPublicHttpUrl(parsed);

  const apiKey = await getCredential("assemblyai");
  if (!apiKey?.trim()) {
    throw new Error(
      "AssemblyAI API key not configured. Mac: Keychain item linkdup / assemblyai. VPS: set ASSEMBLYAI_API_KEY in .env.production."
    );
  }

  const tmpDir = path.join(getDataDir(), "tmp");
  fs.mkdirSync(tmpDir, { recursive: true });
  const base = path.join(tmpDir, `audio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const outTemplate = `${base}.%(ext)s`;

  const ytDlpBin =
    process.env.YT_DLP_PATH ||
    ["/usr/local/bin/yt-dlp", "/usr/bin/yt-dlp", "yt-dlp"].find((p) => {
      try {
        fs.accessSync(p, fs.constants.X_OK);
        return true;
      } catch {
        return false;
      }
    }) ||
    "yt-dlp";

  try {
    await execFileAsync(
      ytDlpBin,
      [
        "-x",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "-o",
        outTemplate,
        "--no-playlist",
        "--no-warnings",
        "--no-cache-dir",
        "--no-mtime",
        url.trim(),
      ],
      { timeout: YT_DLP_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `yt-dlp failed (is ffmpeg installed? is the URL public?): ${msg.slice(0, 400)}`
    );
  }

  const dir = path.dirname(base);
  const prefix = path.basename(base);
  const produced = fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && /\.(mp3|m4a|opus|webm|wav)$/i.test(f));
  if (produced.length === 0) {
    throw new Error("yt-dlp produced no audio file — check URL and platform support");
  }
  const audioPath = path.join(dir, produced[0]!);

  try {
    const uploadUrl = await assemblyUpload(apiKey.trim(), audioPath);
    const transcriptId = await assemblyCreateJob(apiKey.trim(), uploadUrl);
    const text = await assemblyPollUntilDone(apiKey.trim(), transcriptId);
    return text.replace(/\s+/g, " ").trim();
  } finally {
    try {
      fs.unlinkSync(audioPath);
    } catch {
      /* ignore */
    }
  }
}
