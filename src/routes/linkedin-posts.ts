import { Router } from "express";
import multer from "multer";
import { getDb } from "../db/index.js";
import { getCredential } from "../credentials.js";

const upload = multer({ storage: multer.memoryStorage() });
export const linkedinPostsRouter = Router();

// GET /api/linkedin-posts — Fetch all LinkedIn posts
linkedinPostsRouter.get("/", (_req, res) => {
  const db = getDb();
  const posts = db.prepare("SELECT * FROM linkedin_posts ORDER BY published_date DESC").all();
  res.json(posts);
});

// POST /api/linkedin-posts/import — Import LinkedIn posts from CSV file
linkedinPostsRouter.post("/import", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });

  try {
    const csvText = req.file.buffer.toString("utf-8");
    const db = getDb();

    const lines = csvText.split("\n");
    if (lines.length < 2) {
      return res.json({ imported: 0, skipped: 0 });
    }

    const headers = lines[0].split(",").map((h) => h.trim());
    let imported = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(",").map((v) => v.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] || "";
      });

      try {
        db.prepare(
          `INSERT INTO linkedin_posts (text, published_date, linkedin_url, likes, comments, shares, impressions, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'import')`
        ).run(
          obj["text"] || obj["Post"] || "",
          obj["date"] || obj["published_date"] || null,
          obj["url"] || obj["linkedin_url"] || null,
          parseInt(obj["likes"] || "0", 10) || 0,
          parseInt(obj["comments"] || "0", 10) || 0,
          parseInt(obj["shares"] || "0", 10) || 0,
          parseInt(obj["impressions"] || "0", 10) || 0
        );
        imported++;
      } catch (e) {
        skipped++;
      }
    }

    res.json({ imported, skipped });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// POST /api/linkedin-posts/scrape — Scrape LinkedIn profile using Apify
linkedinPostsRouter.post("/scrape", async (req, res) => {
  try {
    const apifyKey = getCredential("apify");
    if (!apifyKey) {
      return res.status(400).json({ error: "Apify key not configured" });
    }

    const db = getDb();
    const settings = db.prepare("SELECT linkedin_url FROM settings WHERE id = 1").get() as Record<string, unknown> | undefined;

    if (!settings?.linkedin_url) {
      return res.status(400).json({ error: "LinkedIn URL not set in settings" });
    }

    // Call Apify API
    const apifyUrl = "https://api.apify.com/v2/acts/curious_coder~linkedin-profile-scraper/run";
    const apifyRes = await fetch(apifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apifyKey}`,
      },
      body: JSON.stringify({
        profileUrls: [settings.linkedin_url],
      }),
    });

    if (!apifyRes.ok) {
      throw new Error(`Apify API error: ${apifyRes.statusText}`);
    }

    const runData = (await apifyRes.json()) as { data?: { id: string } };
    const runId = runData.data?.id;

    if (!runId) {
      throw new Error("Failed to start Apify run");
    }

    // Wait for run to complete
    let runStatus: { data?: { status: string; defaultDatasetId: string } } = {};
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes with 1 second intervals

    while (attempts < maxAttempts) {
      const statusRes = await fetch(
        `https://api.apify.com/v2/acts/curious_coder~linkedin-profile-scraper/runs/${runId}`,
        {
          headers: { Authorization: `Bearer ${apifyKey}` },
        }
      );

      if (!statusRes.ok) break;

      runStatus = (await statusRes.json()) as { data?: { status: string; defaultDatasetId: string } };

      if (runStatus.data?.status === "SUCCEEDED") break;
      if (runStatus.data?.status === "FAILED") {
        throw new Error("Apify scrape failed");
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    // Get results from dataset
    const datasetId = runStatus.data?.defaultDatasetId;
    if (!datasetId) {
      throw new Error("No dataset from Apify run");
    }

    const resultsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items`,
      {
        headers: { Authorization: `Bearer ${apifyKey}` },
      }
    );

    if (!resultsRes.ok) {
      throw new Error("Failed to fetch Apify results");
    }

    const results = (await resultsRes.json()) as Array<Record<string, unknown>>;

    // Parse and store posts
    let imported = 0;
    for (const profile of results) {
      const posts = profile.posts as Array<Record<string, unknown>> | undefined;
      if (!posts) continue;

      for (const post of posts) {
        try {
          db.prepare(
            `INSERT INTO linkedin_posts (text, published_date, linkedin_url, likes, comments, shares, impressions, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'scrape')`
          ).run(
            (post.text || post.content || "") as string,
            (post.published_date || post.date) as string | null,
            (post.url || post.postUrl) as string | null,
            parseInt((post.likes || 0) as string, 10) || 0,
            parseInt((post.comments || 0) as string, 10) || 0,
            parseInt((post.shares || 0) as string, 10) || 0,
            parseInt((post.impressions || 0) as string, 10) || 0
          );
          imported++;
        } catch (e) {
          // Ignore duplicates and errors
        }
      }
    }

    res.json({ imported });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
