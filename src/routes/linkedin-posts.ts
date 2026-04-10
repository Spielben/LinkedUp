import { Router } from "express";
import { getDb } from "../db/index.js";
import { getCredential } from "../credentials.js";

export const linkedinPostsRouter = Router();

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
          `INSERT OR IGNORE INTO linkedin_posts (subject, description, text, image_url, published_date, linkedin_url, first_comment, status, likes, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'airtable')`
        ).run(subject, description, text, imageUrl, publishedDate, linkedinUrl, firstComment, mappedStatus, likes);

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
    for (const item of results) {
      // Posts might be at item.posts, item.activities, or the item itself might be a post
      const posts = (item.posts || item.activities || (item.text ? [item] : [])) as Array<Record<string, unknown>>;
      if (!Array.isArray(posts)) {
        // If the whole result is profile data with no posts array, skip
        continue;
      }

      for (const post of posts) {
        const text = (post.text || post.content || post.commentary || "") as string;
        if (!text.trim()) continue;

        const postUrl = (post.url || post.postUrl || post.shareUrl) as string | null;
        try {
          db.prepare(
            `INSERT OR IGNORE INTO linkedin_posts (text, published_date, linkedin_url, likes, comments, shares, impressions, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'apify')`
          ).run(
            text,
            (post.published_date || post.date || post.postedAt || post.postedDate) as string | null,
            postUrl,
            parseInt(String(post.likes || post.numLikes || (post.socialCount as Record<string, unknown>)?.numLikes || 0), 10) || 0,
            parseInt(String(post.comments || post.numComments || (post.socialCount as Record<string, unknown>)?.numComments || 0), 10) || 0,
            parseInt(String(post.shares || post.numShares || (post.socialCount as Record<string, unknown>)?.numShares || 0), 10) || 0,
            parseInt(String(post.impressions || post.numImpressions || 0), 10) || 0
          );
          const changes = db.prepare("SELECT changes() as c").get() as { c: number };
          if (changes.c > 0) imported++;
        } catch {
          // Ignore parse/db edge cases
        }
      }
    }

    res.json({ imported, profilesScanned: results.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
