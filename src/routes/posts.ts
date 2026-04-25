import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../db/index.js";
import { callOpenRouter, estimateCost } from "../services/openrouter.js";
import { publishTextPost, publishPostWithImageBuffers, publishComment } from "../services/linkedin.js";
import { getPostMediaSources, resolveAllMediaSources } from "../services/post-media.js";

export const postsRouter = Router();
const MAX_REFERENCE_CONTENT_ITEMS = 2;
const MAX_REFERENCE_BLOCK_CHARS = 12000;

type PostWithContenus = Record<string, unknown> & {
  id: number;
  contenu_id?: number | null;
  contenu_ids?: number[];
  contenu_names?: string[];
  contenu_name?: string | null;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Remove one or more trailing copies of the signature (handles duplicate AI output + our own appends). */
function stripTrailingSignatures(text: string, signature: string): string {
  const sig = signature.trim();
  if (!sig) return text;
  let t = text.trimEnd();
  for (let i = 0; i < 30; i++) {
    const re = new RegExp(`(?:\\n{1,2})?${escapeRegExp(sig)}\\s*$`, "u");
    const next = t.replace(re, "").trimEnd();
    if (next === t) break;
    t = next;
  }
  return t;
}

function ensureSignature(text: string, signature: string | null | undefined): string {
  if (!signature?.trim()) return text;
  const sig = signature.trim();
  const cleaned = stripTrailingSignatures(text, sig);
  if (!cleaned.trim()) return sig;
  return `${cleaned.trimEnd()}\n\n${sig}`;
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

function sanitizeContenuIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const item of raw) {
    const n = Number(item);
    if (!Number.isInteger(n) || n <= 0) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    ids.push(n);
  }
  return ids;
}

function validateContenuIds(db: ReturnType<typeof getDb>, contenuIds: number[]): void {
  if (contenuIds.length > MAX_REFERENCE_CONTENT_ITEMS) {
    throw new Error(`You can select up to ${MAX_REFERENCE_CONTENT_ITEMS} content sources`);
  }
  if (contenuIds.length === 0) return;
  const placeholders = contenuIds.map(() => "?").join(", ");
  const rows = db
    .prepare(`SELECT id FROM contenus WHERE id IN (${placeholders})`)
    .all(...contenuIds) as { id: number }[];
  if (rows.length !== contenuIds.length) {
    throw new Error("One or more selected content sources do not exist");
  }
}

function replacePostContenus(
  db: ReturnType<typeof getDb>,
  postId: number,
  contenuIds: number[]
): void {
  const del = db.prepare("DELETE FROM post_contenus WHERE post_id = ?");
  const ins = db.prepare(
    "INSERT INTO post_contenus (post_id, slot, contenu_id) VALUES (?, ?, ?)"
  );
  const setLegacy = db.prepare("UPDATE posts SET contenu_id = ? WHERE id = ?");
  const tx = db.transaction((ids: number[]) => {
    del.run(postId);
    ids.forEach((contenuId, index) => {
      ins.run(postId, index + 1, contenuId);
    });
    setLegacy.run(ids[0] ?? null, postId);
  });
  tx(contenuIds);
}

function attachContenuMeta(
  db: ReturnType<typeof getDb>,
  post: PostWithContenus | undefined
): PostWithContenus | undefined {
  if (!post) return post;
  const rows = db
    .prepare(
      `SELECT pc.contenu_id, c.name
       FROM post_contenus pc
       JOIN contenus c ON c.id = pc.contenu_id
       WHERE pc.post_id = ?
       ORDER BY pc.slot ASC`
    )
    .all(post.id) as { contenu_id: number; name: string | null }[];
  const contenu_ids = rows.map((r) => r.contenu_id);
  const contenu_names = rows.map((r) => r.name || "(untitled)");
  return {
    ...post,
    contenu_ids,
    contenu_names,
    contenu_name: contenu_names[0] ?? null,
    contenu_id: contenu_ids[0] ?? null,
  };
}

function attachContenuMetaList(
  db: ReturnType<typeof getDb>,
  posts: PostWithContenus[]
): PostWithContenus[] {
  return posts.map((post) => attachContenuMeta(db, post) as PostWithContenus);
}

function buildReferenceContentBlock(
  refs: { slot: number; name: string | null; summary: string | null; raw: string | null }[],
  fallback: string
): string {
  if (refs.length === 0) return fallback;
  const block = refs
    .map((ref) => {
      const body = (ref.summary || ref.raw || "").trim() || fallback;
      return `Source ${ref.slot} — ${ref.name || "Untitled"}\n${body}`;
    })
    .join("\n\n---\n\n");
  return block.slice(0, MAX_REFERENCE_BLOCK_CHARS);
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
  `).all() as PostWithContenus[];
  res.json(attachContenuMetaList(db, posts));
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
  `).get(req.params.id) as PostWithContenus | undefined;
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json(attachContenuMeta(db, post));
});

postsRouter.post("/", (req, res) => {
  const db = getDb();
  const { subject, description, model, status, style_id, template_id, contenu_id, contenu_ids, publication_date } = req.body;
  const normalizedContenuIds = sanitizeContenuIds(
    Array.isArray(contenu_ids)
      ? contenu_ids
      : contenu_id != null
        ? [contenu_id]
        : []
  );
  try {
    validateContenuIds(db, normalizedContenuIds);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid content sources";
    return res.status(400).json({ error: msg });
  }
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
    normalizedContenuIds[0] ?? null,
    publication_date || null
  );
  replacePostContenus(db, Number(result.lastInsertRowid), normalizedContenuIds);
  res.status(201).json({ id: result.lastInsertRowid });
});

postsRouter.put("/:id", (req, res) => {
  const db = getDb();
  const fields = req.body;
  let nextContenuIds: number[] | null = null;
  if ("contenu_ids" in fields || "contenu_id" in fields) {
    nextContenuIds = sanitizeContenuIds(
      Array.isArray(fields.contenu_ids)
        ? fields.contenu_ids
        : fields.contenu_id != null
          ? [fields.contenu_id]
          : []
    );
    try {
      validateContenuIds(db, nextContenuIds);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid content sources";
      return res.status(400).json({ error: msg });
    }
  }
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === "id") continue;
    if (key === "contenu_ids") continue;
    if (key === "contenu_id" && nextContenuIds !== null) continue;
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

  if (setClauses.length > 0) {
    values.push(req.params.id);
    db.prepare(`UPDATE posts SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);
  } else if (nextContenuIds === null) {
    return res.status(400).json({ error: "No fields to update" });
  }
  if (nextContenuIds !== null) {
    replacePostContenus(db, Number(req.params.id), nextContenuIds);
  }

  const updated = db.prepare(`
    SELECT p.*, s.name as style_name, t.name as template_name, c.name as contenu_name
    FROM posts p
    LEFT JOIN styles s ON p.style_id = s.id
    LEFT JOIN templates t ON p.template_id = t.id
    LEFT JOIN contenus c ON p.contenu_id = c.id
    WHERE p.id = ?
  `).get(req.params.id) as PostWithContenus | undefined;
  res.json(attachContenuMeta(db, updated));
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
  const references = db
    .prepare(
      `SELECT pc.slot, c.name, c.summary, c.content_raw
       FROM post_contenus pc
       JOIN contenus c ON c.id = pc.contenu_id
       WHERE pc.post_id = ?
       ORDER BY pc.slot ASC`
    )
    .all(req.params.id) as {
    slot: number;
    name: string | null;
    summary: string | null;
    content_raw: string | null;
  }[];

  const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as Record<string, string | null> | undefined;

  const model = (post.model as string) || "anthropic/claude-sonnet-4";

  const brandIdentityBlock = settings?.brand_identity_text
    ? `## Brand Identity & Tone of Voice\n\n${settings.brand_identity_text}\n\n---\n\n`
    : "";

  const useFr = (settings as { language?: string | null } | null | undefined)?.language === "fr";
  const referenceBlockFr = buildReferenceContentBlock(
    references.map((r) => ({ slot: r.slot, name: r.name, summary: r.summary, raw: r.content_raw })),
    "Aucun contenu de référence fourni."
  );
  const referenceBlockEn = buildReferenceContentBlock(
    references.map((r) => ({ slot: r.slot, name: r.name, summary: r.summary, raw: r.content_raw })),
    "No reference content provided."
  );

  const prompt = useFr
    ? `Tu es un expert en création de posts LinkedIn engageants et viraux.

Ton objectif est de rédiger 3 versions différentes d'un post LinkedIn en respectant le style d'écriture, la structure du template (si fourni), et en intégrant le contenu de référence (si fourni). Rédige tout en français.

---

${brandIdentityBlock}## Informations du post

**Sujet** : ${post.subject}

**Description / instructions** :
${post.description || "Aucune description fournie."}

---

## Style d'écriture à reproduire

${post.style_instructions || "Aucun style défini. Utilise un ton professionnel et engageant."}

---

## Template / structure à suivre (optionnel)

${post.template_text || "Aucun template fourni. Utilise une structure engageante adaptée au sujet."}

---

## Contenu de référence (optionnel)

${referenceBlockFr}

---

## Signature (référence uniquement — ne pas la recopier dans V1, V2 ou V3)

${settings?.signature || "Aucune."}

---

## Consignes

1. Génère exactement 3 versions du post, chacune avec un angle/hook différent
2. Chaque version doit :
   - Respecter le ton de voix décrit dans le style
   - Suivre la structure du template si fourni
   - Intégrer les informations clés de la description
   - Utiliser le contenu de référence si fourni
   - **Ne pas** inclure la signature dans le texte des versions — elle est ajoutée automatiquement après génération
3. Les 3 versions doivent être distinctes :
   - V1 : accroche par une question ou un problème
   - V2 : accroche par une observation ou une analyse
   - V3 : accroche par des chiffres, un angle original ou une liste
4. Format LinkedIn : phrases courtes, sauts de ligne, emojis si le style le permet
5. Longueur : 600-900 caractères par version

Retourne le résultat dans ce format exact :

V1:
[contenu de la version 1]

V2:
[contenu de la version 2]

V3:
[contenu de la version 3]`
    : `You are an expert at writing engaging, high-performing LinkedIn posts.

Your job is to write 3 different versions of a LinkedIn post, matching the writing style, following the template structure when provided, and using the reference content when provided. Write everything in English (default for international LinkedIn).

---

${brandIdentityBlock}## Post brief

**Subject:** ${post.subject}

**Description / instructions:**
${post.description || "None provided."}

---

## Style to emulate

${post.style_instructions || "No style provided. Use a professional, engaging tone."}

---

## Template / structure (optional)

${post.template_text || "No template provided. Use an engaging structure that fits the subject."}

---

## Reference content (optional)

${referenceBlockEn}

---

## Signature (reference only — do not paste into V1, V2, or V3)

${settings?.signature || "None."}

---

## Requirements

1. Generate exactly 3 post versions, each with a different angle or hook
2. Each version must:
   - Match the voice described in the style
   - Follow the template structure when a template is provided
   - Use the key points from the description
   - Use the reference content when provided
   - **Do not** include the signature in the body of any version — the app appends it automatically after generation
3. The 3 versions must differ in approach:
   - V1: Hook with a question or a problem
   - V2: Hook with an observation or analysis
   - V3: Hook with numbers, a contrarian angle, or a list
4. LinkedIn style: short lines, line breaks, emojis if the style allows
5. Length: about 600–900 characters per version

Return the result in this exact format:

V1:
[version 1 content]

V2:
[version 2 content]

V3:
[version 3 content]`;

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
    `).get(req.params.id) as PostWithContenus | undefined;

    res.json(attachContenuMeta(db, updated));
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

  const fullSettings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as { language?: string | null } | undefined;
  const useFr = fullSettings?.language === "fr";

  const prompt = useFr
    ? `Tu es un expert en optimisation de posts LinkedIn.

Optimise le post suivant en appliquant les instructions d'optimisation tout en préservant le ton de voix de l'auteur. Rends le texte en français.

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
5. Ne duplique pas la signature : le post peut déjà se terminer par la signature — garde une seule occurrence en fin de texte.

Retourne uniquement le post optimisé, sans commentaire ni explication.`
    : `You are an expert at optimizing LinkedIn posts.

Refine the post below using the optimization instructions while preserving the author's voice. Output in English.

---

## Current post

${post.final_version}

---

## Optimization instructions

${post.optimization_instructions}

---

## Writing style to preserve

${post.style_instructions || "No specific style provided."}

---

## Rules

1. Apply the optimization instructions to the post
2. Keep the same voice and writing style
3. Keep the overall structure
4. Stay roughly the same length
5. Do not duplicate the signature: the post may already end with it — keep exactly one signature block at the end.

Return only the optimized post, with no comments or meta-explanation.`;

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
    `).get(req.params.id) as PostWithContenus | undefined;

    res.json(attachContenuMeta(db, updated));
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
    `).get(req.params.id) as PostWithContenus | undefined;

    res.json(attachContenuMeta(db, updated));
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

postsRouter.post("/:id/detach-linkedin", (req, res) => {
  const db = getDb();
  const post = db
    .prepare("SELECT id, linkedin_post_id, linkedin_post_url FROM posts WHERE id = ?")
    .get(req.params.id) as
    | { id: number; linkedin_post_id: string | null; linkedin_post_url: string | null }
    | undefined;
  if (!post) return res.status(404).json({ error: "Post not found" });

  db.prepare(
    `UPDATE posts
     SET linkedin_post_id = NULL,
         linkedin_post_url = NULL,
         publish_error = NULL,
         first_comment_posted = 0,
         status = CASE WHEN status = 'Published' THEN 'Draft' ELSE status END
     WHERE id = ?`
  ).run(req.params.id);

  const updated = db.prepare(`
    SELECT p.*, s.name as style_name, t.name as template_name, c.name as contenu_name
    FROM posts p
    LEFT JOIN styles s ON p.style_id = s.id
    LEFT JOIN templates t ON p.template_id = t.id
    LEFT JOIN contenus c ON p.contenu_id = c.id
    WHERE p.id = ?
  `).get(req.params.id) as PostWithContenus | undefined;

  res.json(attachContenuMeta(db, updated));
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
