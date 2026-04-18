import { Router } from "express";
import { getDb } from "../db/index.js";
import {
  publishTextPost,
  publishPostWithImageBuffers,
  publishComment,
} from "../services/linkedin.js";
import {
  getPostMediaSources,
  resolveAllMediaSources,
} from "../services/post-media.js";

export const schedulerRouter = Router();

// ── Shared helper (same logic as in posts.ts) ────────────────────────────────
function resolvePostBodyForPublish(
  post: Record<string, unknown>
): string | null {
  const final = (post.final_version as string | null)?.trim();
  if (final) return final;
  const sel = (post.selected_version as string | null)
    ?.trim()
    .toUpperCase();
  if (sel === "V1" && post.v1) return String(post.v1).trim() || null;
  if (sel === "V2" && post.v2) return String(post.v2).trim() || null;
  if (sel === "V3" && post.v3) return String(post.v3).trim() || null;
  return null;
}

// ── POST /api/internal/run-scheduled ────────────────────────────────────────
//
//  Called by N8N (or any trusted scheduler) every few minutes.
//  Authentication: x-internal-token header must match process.env.INTERNAL_API_TOKEN.
//  Nothing is exposed publicly — mount this under /api/internal in server.ts.
//
schedulerRouter.post("/run-scheduled", async (req, res) => {
  // ── Auth: token must be configured AND match ──────────────────────────────
  const token = process.env.INTERNAL_API_TOKEN?.trim();

  if (!token) {
    // Fail-safe: refuse all requests if the token is not set in env
    return res
      .status(503)
      .json({ error: "Scheduler not available (INTERNAL_API_TOKEN not set)" });
  }

  const provided = (req.headers["x-internal-token"] as string | undefined)
    ?.trim();

  if (!provided || provided !== token) {
    // Generic 401 — don't reveal the reason
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ── Find posts due for auto-publish ──────────────────────────────────────
  const db = getDb();

  const duePosts = db
    .prepare(
      `SELECT * FROM posts
       WHERE status = 'Programmé'
         AND publication_date IS NOT NULL
         AND publication_date <= datetime('now')
         AND linkedin_post_id IS NULL
       ORDER BY publication_date ASC
       LIMIT 10`
    )
    .all() as Record<string, unknown>[];

  if (duePosts.length === 0) {
    return res.json({ published: 0, skipped: 0, errors: 0, results: [] });
  }

  const results: {
    id: number;
    subject: string | null;
    status: "published" | "skipped" | "error";
    error?: string;
  }[] = [];

  for (const post of duePosts) {
    const postId = post.id as number;
    const subject = post.subject as string | null;
    const text = resolvePostBodyForPublish(post);

    // ── Skip posts without publishable body ─────────────────────────────────
    if (!text) {
      const msg = "Auto-publish skipped: no final or selected version";
      db.prepare(
        "UPDATE posts SET status = 'Idée', publish_error = ? WHERE id = ?"
      ).run(msg, postId);
      db.prepare(
        `INSERT INTO publish_log (post_id, action, status, response_body)
         VALUES (?, 'auto-publish', 'skipped', ?)`
      ).run(postId, msg);
      results.push({ id: postId, subject, status: "skipped", error: msg });
      continue;
    }

    // ── Attempt publish ──────────────────────────────────────────────────────
    try {
      let result: { postId: string; postUrl: string };

      const sources = getPostMediaSources({
        media_json: post.media_json as string | null,
        image_path: post.image_path as string | null,
      });

      if (sources.length > 0) {
        const buffers = await resolveAllMediaSources(sources, process.cwd());
        result = await publishPostWithImageBuffers(text, buffers);
      } else {
        result = await publishTextPost(text);
      }

      // Update post record
      db.prepare(
        `UPDATE posts SET
           linkedin_post_id  = ?,
           linkedin_post_url = ?,
           status            = 'Publie',
           publish_error     = NULL
         WHERE id = ?`
      ).run(result.postId, result.postUrl, postId);

      // Log success
      db.prepare(
        `INSERT INTO publish_log (post_id, action, status, response_body)
         VALUES (?, 'auto-publish', 'success', ?)`
      ).run(postId, JSON.stringify(result));

      // First comment (non-blocking)
      const firstComment = post.first_comment as string | null;
      if (firstComment?.trim() && result.postId) {
        try {
          await publishComment(result.postId, firstComment.trim());
          db.prepare(
            "UPDATE posts SET first_comment_posted = 1 WHERE id = ?"
          ).run(postId);
        } catch (commentErr: unknown) {
          const cmsg =
            commentErr instanceof Error
              ? commentErr.message
              : String(commentErr);
          db.prepare(
            `INSERT INTO publish_log (post_id, action, status, response_body)
             VALUES (?, 'first_comment', 'error', ?)`
          ).run(postId, cmsg);
        }
      }

      results.push({ id: postId, subject, status: "published" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      db.prepare(
        "UPDATE posts SET publish_error = ? WHERE id = ?"
      ).run(msg, postId);
      db.prepare(
        `INSERT INTO publish_log (post_id, action, status, response_body)
         VALUES (?, 'auto-publish', 'error', ?)`
      ).run(postId, msg);
      results.push({ id: postId, subject, status: "error", error: msg });
    }
  }

  const published = results.filter((r) => r.status === "published").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;

  res.json({ published, skipped, errors, results });
});
