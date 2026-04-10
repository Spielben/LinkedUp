#!/usr/bin/env npx tsx
/**
 * fix-images.ts — Find and fix broken/missing images for LinkedIn posts.
 *
 * Strategy:
 * 1. Check all posts with image_url — test if the URL is still valid
 * 2. For posts with a linkedin_url — scrape the Open Graph image from the LinkedIn post page
 * 3. Download valid images locally to data/images/
 * 4. Update the DB to point to the local copy
 *
 * Usage: npx tsx bin/fix-images.ts
 */

import path from "node:path";
import fs from "node:fs";
import { getDb, getDataDir } from "../src/db/index.js";

const IMAGES_DIR = path.join(getDataDir(), "images");
fs.mkdirSync(IMAGES_DIR, { recursive: true });

interface PostRow {
  id: number;
  subject: string | null;
  image_url: string | null;
  linkedin_url: string | null;
}

async function checkUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10000) });
    return res.ok && (res.headers.get("content-type")?.startsWith("image/") ?? false);
  } catch {
    return false;
  }
}

async function fetchOgImage(linkedinUrl: string): Promise<string | null> {
  try {
    const res = await fetch(linkedinUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract og:image
    const ogMatch = html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i)
      || html.match(/content="([^"]+)"\s+(?:property|name)="og:image"/i);
    return ogMatch?.[1] || null;
  } catch {
    return null;
  }
}

async function downloadImage(url: string, postId: number): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const filename = `post-${postId}.${ext}`;
    const filepath = path.join(IMAGES_DIR, filename);

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    // Return the URL path that the Express server will serve
    return `/data/images/${filename}`;
  } catch {
    return null;
  }
}

async function main() {
  const db = getDb();
  const posts = db.prepare(
    "SELECT id, subject, image_url, linkedin_url FROM linkedin_posts"
  ).all() as PostRow[];

  console.log(`\nChecking ${posts.length} posts...\n`);

  let fixed = 0;
  let alreadyOk = 0;
  let noSource = 0;
  let failed = 0;

  for (const post of posts) {
    const label = `[${post.id}] ${(post.subject || "").slice(0, 50)}`;

    // Step 1: Check if current image_url works
    if (post.image_url) {
      // Already a local path
      if (post.image_url.startsWith("/data/images/")) {
        const localPath = path.join(process.cwd(), post.image_url);
        if (fs.existsSync(localPath)) {
          alreadyOk++;
          continue;
        }
      }

      const valid = await checkUrl(post.image_url);
      if (valid) {
        // Download to local
        console.log(`  ${label} — downloading existing image...`);
        const localUrl = await downloadImage(post.image_url, post.id);
        if (localUrl) {
          db.prepare("UPDATE linkedin_posts SET image_url = ? WHERE id = ?").run(localUrl, post.id);
          fixed++;
          continue;
        }
      }
    }

    // Step 2: Try fetching OG image from LinkedIn post URL
    if (post.linkedin_url) {
      console.log(`  ${label} — fetching OG image from LinkedIn...`);
      const ogUrl = await fetchOgImage(post.linkedin_url);
      if (ogUrl) {
        const localUrl = await downloadImage(ogUrl, post.id);
        if (localUrl) {
          db.prepare("UPDATE linkedin_posts SET image_url = ? WHERE id = ?").run(localUrl, post.id);
          fixed++;
          console.log(`    -> fixed!`);
          continue;
        }
      }
    }

    if (!post.image_url && !post.linkedin_url) {
      noSource++;
    } else {
      failed++;
      console.log(`  ${label} — could not fix`);
    }
  }

  console.log(`\n--- Results ---`);
  console.log(`Already OK (local): ${alreadyOk}`);
  console.log(`Fixed: ${fixed}`);
  console.log(`No source: ${noSource}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${posts.length}`);
}

main().catch(console.error);
