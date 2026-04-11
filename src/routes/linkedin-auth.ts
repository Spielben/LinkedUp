import { Router } from "express";
import {
  buildAuthUrl,
  exchangeCodeForToken,
  getConnectionStatus,
  LINKEDIN_REDIRECT_URI,
  parseOAuthState,
} from "../services/linkedin.js";
import {
  deleteCredential,
  getCredential,
} from "../credentials.js";

export const linkedinAuthRouter = Router();

// GET /api/linkedin/auth — JSON { url } for popup or same-tab OAuth
// Query: return_origin — frontend origin (e.g. http://localhost:5173) for postMessage after redirect
linkedinAuthRouter.get("/auth", async (req, res) => {
  try {
    const ro = typeof req.query.return_origin === "string" ? req.query.return_origin : undefined;
    const url = await buildAuthUrl(ro);
    res.json({ url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// GET /api/linkedin/setup — safe diagnostics (no secrets)
linkedinAuthRouter.get("/setup", async (_req, res) => {
  const hasClientId = !!(await getCredential("linkedin_client_id"));
  const hasClientSecret = !!(await getCredential("linkedin_client_secret"));
  res.json({
    hasClientId,
    hasClientSecret,
    redirectUri: LINKEDIN_REDIRECT_URI,
    checklist: [
      "LinkedIn app → Auth: add Authorized redirect URL exactly: http://localhost:3000/api/linkedin/callback",
      "Products: Sign In with LinkedIn (OpenID) + Share on LinkedIn (w_member_social)",
      "Keychain: linkedin_client_id and linkedin_client_secret under service name linkdup",
    ],
  });
});

// GET /api/linkedin/callback — OAuth callback from LinkedIn (opens in popup)
linkedinAuthRouter.get("/callback", async (req, res) => {
  const stateParam = typeof req.query.state === "string" ? req.query.state : undefined;
  const { postMessageOrigin } = parseOAuthState(stateParam);
  const originJs = JSON.stringify(postMessageOrigin);

  const { code, error, error_description } = req.query;

  const safeErr = (s: string) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  if (error) {
    const detail = safeErr(String(error_description || error || "unknown"));
    return res.status(400).send(
      `<!DOCTYPE html><html><body><h2>LinkedIn authorization failed</h2><p>${detail}</p>
<script>(function(){var o=${originJs};try{if(window.opener)window.opener.postMessage({type:"linkedin-oauth-error",detail:${JSON.stringify(String(error_description || error))}},o);}catch(e){}})();setTimeout(function(){window.close();},800);</script></body></html>`
    );
  }

  if (!code || typeof code !== "string") {
    return res.status(400).send(
      `<!DOCTYPE html><html><body><h2>Missing authorization code</h2>
<script>(function(){var o=${originJs};try{if(window.opener)window.opener.postMessage({type:"linkedin-oauth-error",detail:"missing_code"},o);}catch(e){}})();setTimeout(function(){window.close();},800);</script></body></html>`
    );
  }

  try {
    await exchangeCodeForToken(code);
    res.send(
      `<!DOCTYPE html><html><body><h2>LinkedIn connected</h2><p>You can close this window.</p>
<script>(function(){var o=${originJs};try{if(window.opener)window.opener.postMessage("linkedin-connected",o);}catch(e){}})();setTimeout(function(){window.close();},300);</script></body></html>`
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const safe = safeErr(msg);
    res.status(500).send(
      `<!DOCTYPE html><html><body><h2>Error connecting LinkedIn</h2><p>${safe}</p>
<script>(function(){var o=${originJs};try{if(window.opener)window.opener.postMessage({type:"linkedin-oauth-error",detail:${JSON.stringify(msg)}},o);}catch(e){}})();setTimeout(function(){window.close();},1200);</script></body></html>`
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
