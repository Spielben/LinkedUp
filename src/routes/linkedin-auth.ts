import { Router } from "express";
import {
  buildAuthUrl,
  exchangeCodeForToken,
  getConnectionStatus,
} from "../services/linkedin.js";
import {
  deleteCredential,
} from "../credentials.js";

export const linkedinAuthRouter = Router();

// GET /api/linkedin/auth — Redirect to LinkedIn OAuth
linkedinAuthRouter.get("/auth", async (_req, res) => {
  try {
    const url = await buildAuthUrl();
    res.json({ url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// GET /api/linkedin/callback — OAuth callback from LinkedIn
linkedinAuthRouter.get("/callback", async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(
      `<html><body><h2>LinkedIn authorization failed</h2><p>${error_description || error}</p><script>window.close()</script></body></html>`
    );
  }

  if (!code || typeof code !== "string") {
    return res.status(400).send(
      `<html><body><h2>Missing authorization code</h2><script>window.close()</script></body></html>`
    );
  }

  try {
    await exchangeCodeForToken(code);
    res.send(
      `<html><body><h2>LinkedIn connected successfully!</h2><p>You can close this window.</p><script>window.opener?.postMessage("linkedin-connected","*");window.close()</script></body></html>`
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).send(
      `<html><body><h2>Error connecting LinkedIn</h2><p>${msg}</p><script>window.close()</script></body></html>`
    );
  }
});

// GET /api/linkedin/status — Check connection status
linkedinAuthRouter.get("/status", async (_req, res) => {
  try {
    const status = await getConnectionStatus();
    res.json(status);
  } catch {
    res.json({ connected: false });
  }
});

// POST /api/linkedin/disconnect — Remove stored tokens
linkedinAuthRouter.post("/disconnect", async (_req, res) => {
  await deleteCredential("linkedin_access_token");
  await deleteCredential("linkedin_refresh_token");
  await deleteCredential("linkedin_person_urn");
  res.json({ ok: true });
});
