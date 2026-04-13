import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb, closeDb } from "./db/index.js";
import { postsRouter } from "./routes/posts.js";
import { stylesRouter } from "./routes/styles.js";
import { templatesRouter } from "./routes/templates.js";
import { contenusRouter } from "./routes/contenus.js";
import { settingsRouter } from "./routes/settings.js";
import { seedRouter } from "./routes/seed.js";
import { importRouter } from "./routes/import.js";
import { linkedinPostsRouter } from "./routes/linkedin-posts.js";
import { linkedinAuthRouter } from "./routes/linkedin-auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function isAllowedDevCorsOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1") return true;
    if (h.endsWith(".local")) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    return false;
  } catch {
    return false;
  }
}

export function createServer(port = 3000) {
  const app = express();

  // CORS: Vite on :5173 / preview / vite --host (LAN) → API on :3000
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (typeof origin === "string" && isAllowedDevCorsOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));

  // API routes
  app.use("/api/posts", postsRouter);
  app.use("/api/styles", stylesRouter);
  app.use("/api/templates", templatesRouter);
  app.use("/api/contenus", contenusRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/seed", seedRouter);
  app.use("/api/import", importRouter);
  app.use("/api/linkedin-posts", linkedinPostsRouter);
  app.use("/api/linkedin", linkedinAuthRouter);

  // Unmatched /api/* → JSON 404 (never return SPA index.html for API paths)
  app.use((req, res, next) => {
    const pathOnly = req.path || "";
    if (pathOnly === "/api" || pathOnly.startsWith("/api/")) {
      return res.status(404).type("application/json").json({ error: "Not found", path: pathOnly });
    }
    next();
  });

  // Serve downloaded images from data/images/
  const imagesDir = path.join(process.cwd(), "data", "images");
  console.log("  Serving images from:", imagesDir);
  app.get("/data/images/:file", (req, res, next) => {
    const filePath = path.join(imagesDir, req.params.file);
    res.sendFile(filePath, (err) => {
      if (err) next();
    });
  });

  const clientDist = path.join(__dirname, "../dist/client");
  const isDev = Boolean(process.env.DEV);
  /** Vite dev server (UI with Tailwind HMR). Never serve stale dist/client in DEV. */
  const viteDevOrigin = (process.env.VITE_DEV_ORIGIN || "http://127.0.0.1:5173").replace(/\/$/, "");

  if (isDev) {
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      const p = req.path || "";
      if (p.startsWith("/api") || p.startsWith("/data/")) return next();
      const loc = `${viteDevOrigin}${req.originalUrl || "/"}`;
      return res.redirect(302, loc);
    });
  } else {
    app.use(express.static(clientDist));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  // Initialize database
  getDb();

  const server = app.listen(port, () => {
    if (isDev) {
      console.log(`\n  🔗 LINK'DUP API + OAuth: http://localhost:${port}`);
      console.log(`  📱 Open the UI (Vite + responsive CSS): ${viteDevOrigin}`);
      console.log(`     Run in another terminal: npm run dev:client`);
      console.log(`     Or once: npm run dev:all\n`);
    } else {
      console.log(`\n  🔗 LINK'DUP running at http://localhost:${port}\n`);
    }
  });

  process.on("SIGINT", () => {
    closeDb();
    server.close();
    process.exit(0);
  });

  return server;
}
