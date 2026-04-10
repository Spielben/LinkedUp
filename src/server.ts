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

export function createServer(port = 3000) {
  const app = express();

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

  // Serve downloaded images from data/images/
  const imagesDir = path.join(process.cwd(), "data", "images");
  console.log("  Serving images from:", imagesDir);
  app.get("/data/images/:file", (req, res, next) => {
    const filePath = path.join(imagesDir, req.params.file);
    res.sendFile(filePath, (err) => {
      if (err) next();
    });
  });

  // Serve built client in production
  const clientDist = path.join(__dirname, "../dist/client");
  app.use(express.static(clientDist));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });

  // Initialize database
  getDb();

  const server = app.listen(port, () => {
    console.log(`\n  🔗 LINK'DUP running at http://localhost:${port}\n`);
  });

  process.on("SIGINT", () => {
    closeDb();
    server.close();
    process.exit(0);
  });

  return server;
}
