import { Router } from "express";
import { getDb } from "../db/index.js";
import { getCredential } from "../credentials.js";

export const linkedinPostsRouter = Router();

/** Detect repost/reshare from Apify or similar LinkedIn post payloads */
function isRepostFromPayload(post: Record<string, unknown>): boolean {
  const truthy = (v: unknown) => v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true" || String(v).toLowerCase() === "yes";
  if (truthy(post.isRepost)) return true;
  if (truthy(post.is_repost)) return true;
  if (truthy(post.isReshare)) return true;
  const pt = String(post.postType || post.type || post.activityType || "").toLowerCase();
  if (pt.includes("reshare") || pt.includes("repost")) return true;
  if (post.resharedPost && typeof post.resharedPost === "object") return true;
  if (post.originalPost && typeof post.originalPost === "object") return true;
  if (post.sharedPost && typeof post.sharedPost === "object") return true;
  if (post.repostedPost && typeof post.repostedPost === "object") return true;
  const header = post.header;
  if (header && typeof header === "object") {
    const t = String((header as Record<string, unknown>).text || "").toLowerCase();
    if (t.includes("reposted") || t.includes("reshared")) return true;
  }
  return false;
}

/** Pull caption/body from Apify / LinkedIn shapes (several possible field names). */
function extractPostText(post: Record<string, unknown>): string {
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  let t =
    str(post.text) ||
    str(post.content) ||
    str(post.commentary) ||
    str(post.message) ||
    str(post.body) ||
    str(post.postText) ||
    "";

  const sc = post.shareCommentary;
  if (!t && sc && typeof sc === "object") {
    const o = sc as Record<string, unknown>;
    t = str(o.text) || str(o.textLocalized);
  }

  const ugc = post.specificContent;
  if (!t && ugc && typeof ugc === "object") {
    const share = (ugc as Record<string, unknown>)["com.linkedin.ugc.ShareContent"];
    if (share && typeof share === "object") {
      const com = (share as Record<string, unknown>).shareCommentary;
      if (com && typeof com === "object") {
        t = str((com as Record<string, unknown>).text);
      }
    }
  }

  if (!t) t = str(post.headline) || str(post.title) || str(post.articleTitle) || str(post.description);

  if (!t) {
    for (const key of ["resharedPost", "sharedPost", "originalPost", "repostedPost"]) {
      const nested = post[key];
      if (nested && typeof nested === "object") {
        const n = nested as Record<string, unknown>;
        t =
          str(n.text) ||
          str(n.content) ||
          str(n.commentary) ||
          str(n.message) ||
          str(n.headline) ||
          str(n.title) ||
          "";
        if (t) break;
      }
    }
  }

  return t;
}

function normalizePostUrl(post: Record<string, unknown>): string | null {
  const raw = post.url || post.postUrl || post.shareUrl || post.linkedinUrl || post.postLink || post.link;
  if (typeof raw !== "string" || !raw.trim()) return null;
  return raw.trim();
}

// GET /api/linkedin-posts — Fetch all LinkedIn posts
linkedinPostsRouter.get("/", (_req, res) => {
  const db = getDb();
  const posts = db.prepare("SELECT * FROM linkedin_posts ORDER BY published_date DESC").all();
  res.json(posts);
});

// DELETE /api/linkedin-posts/:id
linkedinPostsRouter.delete("/:id", (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM linkedin_posts WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Proper CSV parser — handles quoted fields with commas and newlines
function parseCSV(data: string): string[][] {
  const clean = data.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (char === '"') {
      if (inQuotes && clean[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && clean[i + 1] === "\n") i++;
      row.push(current.trim());
      if (row.some((cell) => cell)) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  row.push(current.trim());
  if (row.some((cell) => cell)) rows.push(row);
  return rows;
}

// POST /api/linkedin-posts/import — Import LinkedIn posts from CSV text (read client-side)
linkedinPostsRouter.post("/import", (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "No content provided" });

  try {
    const db = getDb();
    const rows = parseCSV(content);
    if (rows.length < 2) return res.json({ imported: 0, skipped: 0, duplicates: 0 });

    const headers = rows[0];
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => { headerMap[h] = i; });

    let imported = 0;
    let skipped = 0;
    let duplicates = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.every((cell) => !cell)) { skipped++; continue; }

      // Map Airtable Posts CSV columns
      const subject = row[headerMap["Sujet"]]?.trim() || row[headerMap["subject"]]?.trim() || "";
      const description = row[headerMap["Description"]]?.trim() || row[headerMap["description"]]?.trim() || null;
      const text = row[headerMap["Version Finale"]]?.trim() || row[headerMap["text"]]?.trim() || row[headerMap["Post"]]?.trim() || "";
      const imageRaw = row[headerMap["Image"]]?.trim() || row[headerMap["image_url"]]?.trim() || "";
      const publishedDate = row[headerMap["Date de publication"]]?.trim() || row[headerMap["published_date"]]?.trim() || row[headerMap["Date"]]?.trim() || null;
      const firstComment = row[headerMap["1er commentaire"]]?.trim() || row[headerMap["first_comment"]]?.trim() || null;
      const status = row[headerMap["Statut"]]?.trim() || row[headerMap["status"]]?.trim() || "";
      const linkedinUrl = row[headerMap["URL Post"]]?.trim() || row[headerMap["linkedin_url"]]?.trim() || row[headerMap["url"]]?.trim() || null;
      const likes = parseInt(row[headerMap["Likes"]]?.trim() || row[headerMap["likes"]]?.trim() || "0", 10) || 0;
      const repostRaw =
        row[headerMap["Repost"]]?.trim() ||
        row[headerMap["repost"]]?.trim() ||
        row[headerMap["is_repost"]]?.trim() ||
        "";
      const isRepost =
        /^(1|true|yes|oui|repost|reshare)$/i.test(repostRaw) ||
        repostRaw.toLowerCase().includes("repost");

      // Skip header echoes and empty rows
      if (subject === "Sujet" || status === "Statut") { skipped++; continue; }
      if (!subject && !text && !linkedinUrl) { skipped++; continue; }

      // Map status: Publié → published, Brouillon → draft, Idée → idea
      const mappedStatus = status === "Publié" ? "published" : status === "Brouillon" ? "draft" : status === "Idée" ? "idea" : "published";

      // Extract image URL from Airtable format: "filename (https://...)" → get the URL
      let imageUrl: string | null = null;
      if (imageRaw) {
        const urlMatch = imageRaw.match(/\((https?:\/\/[^)]+)\)/);
        imageUrl = urlMatch ? urlMatch[1] : (imageRaw.startsWith("http") ? imageRaw : null);
      }

      try {
        db.prepare(
          `INSERT OR IGNORE INTO linkedin_posts (subject, description, text, image_url, published_date, linkedin_url, first_comment, status, likes, source, is_repost)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'airtable', ?)`
        ).run(subject, description, text, imageUrl, publishedDate, linkedinUrl, firstComment, mappedStatus, likes, isRepost ? 1 : 0);

        const changes = db.prepare("SELECT changes() as c").get() as { c: number };
        if (changes.c > 0) {
          imported++;
        } else {
          duplicates++;
        }
      } catch (e) {
        skipped++;
      }
    }

    res.json({ imported, skipped, duplicates });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// POST /api/linkedin-posts/scrape — Scrape LinkedIn profile using Apify
linkedinPostsRouter.post("/scrape", async (req, res) => {
  try {
    const apifyKey = await getCredential("apify");
    if (!apifyKey) {
      return res.status(400).json({ error: "Apify key not configured. Run: security add-generic-password -s linkdup -a apify -w YOUR_KEY" });
    }

    const db = getDb();
    const settings = db.prepare("SELECT linkedin_url FROM settings WHERE id = 1").get() as Record<string, unknown> | undefined;

    // Use settings URL or the one from request body
    const linkedinUrl = (req.body.linkedin_url as string) || (settings?.linkedin_url as string);
    if (!linkedinUrl) {
      return res.status(400).json({ error: "LinkedIn URL not set. Go to Settings or pass linkedin_url in request body." });
    }

    // Use harvestapi LinkedIn Profile Posts Scraper (token via header, not query string)
    const apifyUrl =
      "https://api.apify.com/v2/acts/harvestapi~linkedin-profile-posts/run-sync-get-dataset-items?timeout=120";
    const apifyRes = await fetch(apifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apifyKey}`,
      },
      body: JSON.stringify({
        profileUrl: linkedinUrl,
      }),
    });

    if (!apifyRes.ok) {
      const errText = await apifyRes.text();
      throw new Error(`Apify API error (${apifyRes.status}): ${errText.slice(0, 200)}`);
    }

    const results = (await apifyRes.json()) as Array<Record<string, unknown>>;

    // Parse and store posts — Apify returns various shapes, handle flexibly
    let imported = 0;
    let skippedDuplicates = 0;
    let skippedNoText = 0;
    let skippedErrors = 0;
    let postsProcessed = 0;

    for (const item of results) {
      const rawNested = item.posts ?? item.activities;
      const posts = (
        Array.isArray(rawNested) && rawNested.length > 0
          ? rawNested
          : extractPostText(item as Record<string, unknown>)
            ? [item as Record<string, unknown>]
            : []
      ) as Array<Record<string, unknown>>;
      if (!Array.isArray(posts)) continue;

      for (const post of posts) {
        postsProcessed++;
        const text = extractPostText(post);
        if (!text) {
          skippedNoText++;
          continue;
        }

        const postUrl = normalizePostUrl(post);
        const repost = isRepostFromPayload(post) ? 1 : 0;
        const published =
          (post.published_date || post.date || post.postedAt || post.postedDate || post.createdAt || post.timestamp) as
            | string
            | null;

        try {
          db.prepare(
            `INSERT OR IGNORE INTO linkedin_posts (text, published_date, linkedin_url, likes, comments, shares, impressions, source, is_repost)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'apify', ?)`
          ).run(
            text,
            typeof published === "string" ? published : published != null ? String(published) : null,
            postUrl,
            parseInt(String(post.likes || post.numLikes || (post.socialCount as Record<string, unknown>)?.numLikes || 0), 10) || 0,
            parseInt(String(post.comments || post.numComments || (post.socialCount as Record<string, unknown>)?.numComments || 0), 10) || 0,
            parseInt(String(post.shares || post.numShares || (post.socialCount as Record<string, unknown>)?.numShares || 0), 10) || 0,
            parseInt(String(post.impressions || post.numImpressions || 0), 10) || 0,
            repost
          );
          const changes = db.prepare("SELECT changes() as c").get() as { c: number };
          if (changes.c > 0) imported++;
          else skippedDuplicates++;
        } catch {
          skippedErrors++;
        }
      }
    }

    res.json({
      imported,
      skippedDuplicates,
      skippedNoText,
      skippedErrors,
      postsProcessed,
      profilesScanned: results.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
