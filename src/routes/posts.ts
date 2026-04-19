import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../db/index.js";
import { callOpenRouter, estimateCost } from "../services/openrouter.js";
import { publishTextPost, publishPostWithImageBuffers, publishComment } from "../services/linkedin.js";
import { getPostMediaSources, resolveAllMediaSources } from "../services/post-media.js";

export const postsRouter = Router();

function ensureSignature(text: string, signature: string | null | undefined): string {
  if (!signature?.trim()) return text;
  const sig = signature.trim();
  if (text.trim().endsWith(sig)) return text;
  return `${text.trimEnd()}\n\n${sig}`;
}

/** Text to publish: edited final, or the selected V1/V2/V3 body — never the label "V1" etc. */
function resolvePostBodyForPublish(post: Record<string, unknown>): string | null {
  const final = (post.final_version as string | null)?.trim();
  if (final) return final;

  const sel = (post.selected_version as string | null)?.trim().toUpperCase();
  if (sel === "V1" && post.v1) return String(post.v1).trim() || null;
  if (sel === "V2" && post.v2) return String(post.v2).trim() || null;
  if (sel === "V3" && post.v3) return String(post.v3).trim() || null;

  return null;
}

const postMediaUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(process.cwd(), "data", "media", "posts", String(req.params.id));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || "";
      const safe = /^\.(jpe?g|png|gif|webp)$/i.test(ext) ? ext.toLowerCase() : ".bin";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safe}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.mimetype);
    cb(null, ok);
  },
});

postsRouter.get("/", (_req, res) => {
  const db = getDb();
  const posts = db.prepare(`
    SELECT p.*, s.name as style_name, t.name as template_name, c.name as contenu_name
    FROM posts p
    LEFT JOIN styles s ON p.style_id = s.id
    LEFT JOIN templates t ON p.template_id = t.id
    LEFT JOIN contenus c ON p.contenu_id = c.id
    ORDER BY p.created_at DESC
  `).all();
  res.json(posts);
});

postsRouter.get("/:id", (req, res) => {
  const db = getDb();
  const post = db.prepare(`
    SELECT p.*, s.name as style_name, t.name as template_name, c.name as contenu_name
    FROM posts p
    LEFT JOIN styles s ON p.style_id = s.id
    LEFT JOIN templates t ON p.template_id = t.id
    LEFT JOIN contenus c ON p.contenu_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json(post);
});

postsRouter.post("/", (req, res) => {
  const db = getDb();
  const { subject, description, model, status, style_id, template_id, contenu_id, publication_date } = req.body;
  const result = db.prepare(`
    INSERT INTO posts (subject, description, model, status, style_id, template_id, contenu_id, publication_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    subject || null,
    description || null,
    model || "anthropic/claude-sonnet-4",
    status || "Idea",
    style_id || null,
    template_id || null,
    contenu_id || null,
    publication_date || null
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

postsRouter.put("/:id", (req, res) => {
  const db = getDb();
  const fields = req.body;
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === "id") continue;
    if (key === "media_json") {
      if (value === null || value === "") {
        setClauses.push("media_json = ?");
        values.push(null);
      } else if (Array.isArray(value)) {
        setClauses.push("media_json = ?");
        values.push(JSON.stringify(value));
      } else {
        setClauses.push("media_json = ?");
        values.push(value);
      }
      continue;
    }
    setClauses.push(`${key} = ?`);
    values.push(value);
  }

  if (setClauses.length === 0) return res.status(400).json({ error: "No fields to update" });

  values.push(req.params.id);
  db.prepare(`UPDATE posts SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);

  const updated = db.prepare(`
    SELECT p.*, s.name as style_name, t.name as template_name, c.name as contenu_name
    FROM posts p
    LEFT JOIN styles s ON p.style_id = s.id
    LEFT JOIN templates t ON p.template_id = t.id
    LEFT JOIN contenus c ON p.contenu_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);
  res.json(updated);
});

postsRouter.delete("/:id", (req, res) => {
  const db = getDb();
  try {
    // Delete dependent rows first (foreign_keys = ON prevents deleting parent with children)
    db.prepare("DELETE FROM token_usage WHERE post_id = ?").run(req.params.id);
    db.prepare("DELETE FROM publish_log WHERE post_id = ?").run(req.params.id);
    db.prepare("DELETE FROM posts WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── Upload image file → data/media/posts/:id/ (for LinkedIn publish) ───────
postsRouter.post("/:id/upload-media", (req, res, next) => {
  postMediaUpload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const msg =
        err instanceof multer.MulterError
          ? err.code === "LIMIT_FILE_SIZE"
            ? "File too large (max 15 MB)"
            : err.message
          : err instanceof Error
            ? err.message
            : String(err);
      return res.status(400).json({ error: msg });
    }
    next();
  });
}, (req, res) => {
  const db = getDb();
  const exists = db.prepare("SELECT id FROM posts WHERE id = ?").get(req.params.id);
  if (!exists) return res.status(404).json({ error: "Post not found" });
  if (!req.file) return res.status(400).json({ error: "No file (field name: file)" });
  const rel = path.relative(process.cwd(), req.file.path);
  res.json({ path: rel.split(path.sep).join("/") });
});

// ── AI: Generate V1 / V2 / V3 ─────────────────────────────────────────────
postsRouter.post("/:id/generate", async (req, res) => {
  const db = getDb();
  const post = db.prepare(`
    SELECT p.*, s.instructions as style_instructions,
           t.template_text, c.summary as contenu_summary, c.content_raw as contenu_raw
    FROM posts p
    LEFT JOIN styles s ON p.style_id = s.id
    LEFT JOIN templates t ON p.template_id = t.id
    LEFT JOIN contenus c ON p.contenu_id = c.id
    WHERE p.id = ?
  `).get(req.params.id) as Record<string, string | null> | undefined;

  if (!post) return res.status(404).json({ error: "Post not found" });
  if (!post.subject) return res.status(400).json({ error: "Post subject is required to generate content" });

  const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as Record<string, string | null> | undefined;

  const model = (post.model as string) || "anthropic/claude-sonnet-4";

  const prompt = `Tu es un expert en création de posts LinkedIn engageants et viraux.

Ton objectif est de rédiger 3 versions différentes d'un post LinkedIn en respectant le style d'écriture, la structure du template (si fourni), et en intégrant le contenu de référence (si fourni).

---

## Informations du post

**Sujet** : ${post.subject}

**Description / Instructions** :
${post.description || "Aucune description fournie."}

---

## Style d'écriture à reproduire

${post.style_instructions || "Aucun style défini. Utilise un ton professionnel et engageant."}

---

## Template / Structure à suivre (optionnel)

${post.template_text || "Aucun template fourni. Utilise une structure engageante adaptée au sujet."}

---

## Contenu de référence (optionnel)

${post.contenu_summary || post.contenu_raw || "Aucun contenu de référence fourni."}

---

## Signature

${settings?.signature || ""}

---

## Consignes

1. Génère exactement 3 versions du post, chacune avec un angle/hook différent
2. Chaque version doit :
   - Respecter le ton de voix décrit dans le style
   - Suivre la structure du template si fourni
   - Intégrer les informations clés de la description
   - Utiliser le contenu de référence si fourni
   - Se terminer par la signature
3. Les 3 versions doivent être distinctes dans leur approche :
   - V1 : Hook basé sur une question ou un problème
   - V2 : Hook basé sur une observation ou une analyse
   - V3 : Hook basé sur des chiffres, secrets ou une liste
4. Format LinkedIn : phrases courtes, sauts de ligne fréquents, emojis si le style le permet
5. Longueur : 600-900 caractères par version

Retourne le résultat dans ce format exact :

V1:
[contenu de la version 1]

V2:
[contenu de la version 2]

V3:
[contenu de la version 3]`;

  try {
    const { content, usage } = await callOpenRouter({
      messages: [{ role: "user", content: prompt }],
      model,
    });

    const versions = parseVersions(content);
    const sig = settings?.signature ?? null;
    const v1 = versions.v1?.trim() ? ensureSignature(versions.v1.trim(), sig) : null;
    const v2 = versions.v2?.trim() ? ensureSignature(versions.v2.trim(), sig) : null;
    const v3 = versions.v3?.trim() ? ensureSignature(versions.v3.trim(), sig) : null;
    const existingFinal = (post.final_version as string | null)?.trim();
    const finalAfter =
      existingFinal != null && existingFinal !== ""
        ? ensureSignature(existingFinal, sig)
        : null;

    if (finalAfter != null) {
      db.prepare(`
        UPDATE posts SET v1 = ?, v2 = ?, v3 = ?, final_version = ?, status = 'Draft' WHERE id = ?
      `).run(v1, v2, v3, finalAfter, req.params.id);
    } else {
      db.prepare(`
        UPDATE posts SET v1 = ?, v2 = ?, v3 = ?, status = 'Draft' WHERE id = ?
      `).run(v1, v2, v3, req.params.id);
    }

    const cost = estimateCost(model, usage.prompt_tokens, usage.completion_tokens);
    db.prepare(`
      INSERT INTO token_usage (post_id, model, prompt_tokens, completion_tokens, cost_usd)
      VALUES (?, ?, ?, ?, ?)
    `).run(Number(req.params.id), model, usage.prompt_tokens, usage.completion_tokens, cost);

    const updated = db.prepare(`
      SELECT p.*, s.name as style_name, t.name as template_name, c.name as contenu_name
      FROM posts p
      LEFT JOIN styles s ON p.style_id = s.id
      LEFT JOIN templates t ON p.template_id = t.id
      LEFT JOIN contenus c ON p.contenu_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);

    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── AI: Optimize final_version ─────────────────────────────────────────────
postsRouter.post("/:id/optimize", async (req, res) => {
  const db = getDb();
  const post = db.prepare(`
    SELECT p.*, s.instructions as style_instructions
    FROM posts p
    LEFT JOIN styles s ON p.style_id = s.id
    WHERE p.id = ?
  `).get(req.params.id) as Record<string, string | null> | undefined;

  if (!post) return res.status(404).json({ error: "Post not found" });
  if (!post.final_version) return res.status(400).json({ error: "No final version to optimize" });
  if (!post.optimization_instructions) return res.status(400).json({ error: "No optimization instructions provided" });

  const settings = db.prepare("SELECT signature FROM settings WHERE id = 1").get() as
    | { signature: string | null }
    | undefined;

  const model = (post.model as string) || "anthropic/claude-sonnet-4";

  const prompt = `Tu es un expert en optimisation de posts LinkedIn.

Optimise le post suivant en appliquant les instructions d'optimisation tout en préservant le ton de voix de l'auteur.

---

## Post actuel

${post.final_version}

---

## Instructions d'optimisation

${post.optimization_instructions}

---

## Style d'écriture à respecter

${post.style_instructions || "Aucun style défini."}

---

## Consignes

1. Applique les instructions d'optimisation au post
2. Conserve le ton de voix et le style d'écriture
3. Maintiens la structure générale du post
4. Garde la même longueur approximative
5. Ne change pas la signature

Retourne uniquement le post optimisé, sans commentaire ni explication.`;

  try {
    const { content, usage } = await callOpenRouter({
      messages: [{ role: "user", content: prompt }],
      model,
    });

    const optimized = ensureSignature(content.trim(), settings?.signature ?? null);
    db.prepare("UPDATE posts SET final_version = ? WHERE id = ?").run(optimized, req.params.id);

    const cost = estimateCost(model, usage.prompt_tokens, usage.completion_tokens);
    db.prepare(`
      INSERT INTO token_usage (post_id, model, prompt_tokens, completion_tokens, cost_usd)
      VALUES (?, ?, ?, ?, ?)
    `).run(Number(req.params.id), model, usage.prompt_tokens, usage.completion_tokens, cost);

    const updated = db.prepare(`
      SELECT p.*, s.name as style_name, t.name as template_name, c.name as contenu_name
      FROM posts p
      LEFT JOIN styles s ON p.style_id = s.id
      LEFT JOIN templates t ON p.template_id = t.id
      LEFT JOIN contenus c ON p.contenu_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);

    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── LinkedIn: Publish post ────────────────────────────────────────────────
postsRouter.post("/:id/publish", async (req, res) => {
  const db = getDb();
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;

  if (!post) return res.status(404).json({ error: "Post not found" });

  const text = resolvePostBodyForPublish(post);
  if (!text) return res.status(400).json({ error: "No final or selected version to publish" });

  if (post.linkedin_post_id) {
    return res.status(400).json({ error: "Post already published", linkedin_post_url: post.linkedin_post_url });
  }

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
    db.prepare(`
      UPDATE posts SET
        linkedin_post_id = ?,
        linkedin_post_url = ?,
        status = 'Published',
        publication_date = datetime('now'),
        publish_error = NULL
      WHERE id = ?
    `).run(result.postId, result.postUrl, req.params.id);

    // Log success
    db.prepare(`
      INSERT INTO publish_log (post_id, action, status, response_body)
      VALUES (?, 'publish', 'success', ?)
    `).run(Number(req.params.id), JSON.stringify(result));

    // Post first comment if present
    const firstComment = post.first_comment as string | null;
    if (firstComment && result.postId) {
      try {
        await publishComment(result.postId, firstComment);
        db.prepare("UPDATE posts SET first_comment_posted = 1 WHERE id = ?").run(req.params.id);
      } catch (commentErr: unknown) {
        // Log comment error but don't fail the whole publish
        const commentMsg = commentErr instanceof Error ? commentErr.message : String(commentErr);
        db.prepare(`
          INSERT INTO publish_log (post_id, action, status, response_body)
          VALUES (?, 'first_comment', 'error', ?)
        `).run(Number(req.params.id), commentMsg);
      }
    }

    const updated = db.prepare(`
      SELECT p.*, s.name as style_name, t.name as template_name, c.name as contenu_name
      FROM posts p
      LEFT JOIN styles s ON p.style_id = s.id
      LEFT JOIN templates t ON p.template_id = t.id
      LEFT JOIN contenus c ON p.contenu_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);

    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);

    // Store error on the post
    db.prepare("UPDATE posts SET publish_error = ? WHERE id = ?").run(msg, req.params.id);

    // Log failure
    db.prepare(`
      INSERT INTO publish_log (post_id, action, status, response_body)
      VALUES (?, 'publish', 'error', ?)
    `).run(Number(req.params.id), msg);

    res.status(500).json({ error: msg });
  }
});

function parseVersions(text: string): { v1: string; v2: string; v3: string } {
  const v1Match = text.match(/V1:\s*\n([\s\S]*?)(?=\nV2:)/);
  const v2Match = text.match(/V2:\s*\n([\s\S]*?)(?=\nV3:)/);
  const v3Match = text.match(/V3:\s*\n([\s\S]*?)$/);
  return {
    v1: v1Match?.[1]?.trim() || "",
    v2: v2Match?.[1]?.trim() || "",
    v3: v3Match?.[1]?.trim() || "",
  };
}
