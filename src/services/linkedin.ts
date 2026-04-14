import { getCredential, setCredential } from "../credentials.js";
import fs from "node:fs";
import path from "node:path";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_API_BASE = "https://api.linkedin.com";

export const LINKEDIN_REDIRECT_URI = "http://localhost:3000/api/linkedin/callback";
const REDIRECT_URI = LINKEDIN_REDIRECT_URI;
// Requires two LinkedIn products on your app:
//   • "Share on LinkedIn"                       → w_member_social (post creation)
//   • "Sign In with LinkedIn using OpenID Connect" → openid, profile (person ID + name)
const SCOPES = "openid profile w_member_social";

/** Only http(s) localhost / 127.0.0.1 — used for postMessage targetOrigin after OAuth */
export function isAllowedOAuthReturnOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

export type ParsedOAuthState = { postMessageOrigin: string };

/** Decode state from LinkedIn callback (embeds frontend origin for postMessage). */
export function parseOAuthState(state: string | undefined): ParsedOAuthState {
  if (!state || typeof state !== "string") {
    return { postMessageOrigin: "*" };
  }
  try {
    const json = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      v?: number;
      o?: string;
      x?: string;
    };
    if (json.v === 1 && typeof json.o === "string" && isAllowedOAuthReturnOrigin(json.o)) {
      return { postMessageOrigin: json.o };
    }
  } catch {
    // legacy: random alphanumeric state from older builds
  }
  return { postMessageOrigin: "*" };
}

// ── OAuth helpers ──────────────────────────────────────────────────────────

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: "", // filled at call time
    redirect_uri: REDIRECT_URI,
    state,
    scope: SCOPES,
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

export async function buildAuthUrl(returnOrigin?: string): Promise<string> {
  const clientId = await getCredential("linkedin_client_id");
  if (!clientId) {
    throw new Error(
      "LinkedIn Client ID not in Keychain. Run: security add-generic-password -s linkdup -a linkedin_client_id -w YOUR_CLIENT_ID"
    );
  }

  let originForMessage = "http://localhost:5173";
  if (returnOrigin && isAllowedOAuthReturnOrigin(returnOrigin)) {
    originForMessage = returnOrigin;
  }

  const statePayload = {
    v: 1 as const,
    o: originForMessage,
    x: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
  };
  const state = Buffer.from(JSON.stringify(statePayload), "utf8").toString("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    state,
    scope: SCOPES,
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const clientId = await getCredential("linkedin_client_id");
  const clientSecret = await getCredential("linkedin_client_secret");
  if (!clientId || !clientSecret) {
    throw new Error("LinkedIn Client ID or Secret not configured");
  }

  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LinkedIn token exchange failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  // Store tokens
  await setCredential("linkedin_access_token", data.access_token);
  if (data.refresh_token) {
    await setCredential("linkedin_refresh_token", data.refresh_token);
  }

  // Fetch and store person URN
  const urn = await fetchPersonUrn(data.access_token);
  await setCredential("linkedin_person_urn", urn);

  return data;
}

export async function refreshAccessToken(): Promise<string> {
  const clientId = await getCredential("linkedin_client_id");
  const clientSecret = await getCredential("linkedin_client_secret");
  const refreshToken = await getCredential("linkedin_refresh_token");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing LinkedIn credentials for token refresh");
  }

  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LinkedIn token refresh failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  await setCredential("linkedin_access_token", data.access_token);
  if (data.refresh_token) {
    await setCredential("linkedin_refresh_token", data.refresh_token);
  }

  return data.access_token;
}

// ── Person URN ─────────────────────────────────────────────────────────────

/**
 * Decode the JWT payload to extract the `sub` claim (LinkedIn person ID).
 * LinkedIn access tokens are JWTs — this works without any extra API scope.
 */
function extractSubFromJwt(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    ) as Record<string, unknown>;
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Fetch LinkedIn person ID using multiple fallback methods:
 * 1. JWT decode (works if token is a JWT — quick, no API call)
 * 2. Token introspection (works with any token + client credentials, no extra scope)
 * 3. /v2/userinfo (requires openid scope — OpenID Connect product)
 * 4. /v2/me (legacy, requires r_liteprofile or profile scope)
 */
async function fetchPersonUrn(accessToken: string): Promise<string> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const tokenPreview = accessToken.slice(0, 12) + "…";

  console.log("[linkedin] fetchPersonUrn — token prefix:", tokenPreview);

  // Method 1: decode JWT payload
  const jwtSub = extractSubFromJwt(accessToken);
  if (jwtSub) {
    console.log("[linkedin] person ID via JWT decode:", jwtSub);
    return jwtSub;
  }
  console.log("[linkedin] method1 (JWT decode): token is not a JWT, trying introspection…");

  // Method 2: token introspection
  try {
    const clientId = await getCredential("linkedin_client_id");
    const clientSecret = await getCredential("linkedin_client_secret");
    console.log("[linkedin] method2 (introspection): clientId found=", !!clientId, "secret found=", !!clientSecret);
    if (clientId && clientSecret) {
      const res = await fetch("https://www.linkedin.com/oauth/v2/introspectToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: accessToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      const body = await res.text();
      console.log("[linkedin] method2 introspection response:", res.status, body.slice(0, 200));
      if (res.ok) {
        const data = JSON.parse(body) as { active?: boolean; authorized_user?: string };
        if (data.active && data.authorized_user) {
          const match = data.authorized_user.match(/urn:li:(?:member|person):(\w+)/);
          if (match) {
            console.log("[linkedin] person ID via introspection:", match[1]);
            return match[1];
          }
        }
      }
    }
  } catch (e) {
    console.error("[linkedin] method2 introspection error:", e);
  }

  // Method 3: OpenID Connect userinfo
  try {
    const res = await fetch(`${LINKEDIN_API_BASE}/v2/userinfo`, { headers });
    const body = await res.text();
    console.log("[linkedin] method3 /v2/userinfo:", res.status, body.slice(0, 200));
    if (res.ok) {
      const data = JSON.parse(body) as { sub?: string };
      if (data.sub) {
        console.log("[linkedin] person ID via /v2/userinfo:", data.sub);
        return data.sub;
      }
    }
  } catch (e) {
    console.error("[linkedin] method3 error:", e);
  }

  // Method 4: legacy /v2/me
  try {
    const res = await fetch(`${LINKEDIN_API_BASE}/v2/me`, { headers });
    const body = await res.text();
    console.log("[linkedin] method4 /v2/me:", res.status, body.slice(0, 200));
    if (res.ok) {
      const data = JSON.parse(body) as { id?: string };
      if (data.id) {
        console.log("[linkedin] person ID via /v2/me:", data.id);
        return data.id;
      }
    }
  } catch (e) {
    console.error("[linkedin] method4 error:", e);
  }

  throw new Error(
    "Could not determine your LinkedIn person ID. " +
      "Make sure the 'Share on LinkedIn' product is active on your LinkedIn Developer App " +
      "and that your Client ID / Secret are stored correctly in Keychain."
  );
}

// ── Get valid access token (auto-refresh if needed) ────────────────────────

async function getAccessToken(): Promise<string> {
  const token = await getCredential("linkedin_access_token");
  if (!token) throw new Error("LinkedIn not connected. Go to Settings to connect your account.");
  return token;
}

// ── Publish a post ─────────────────────────────────────────────────────────

export async function publishTextPost(text: string): Promise<{
  postId: string;
  postUrl: string;
}> {
  const accessToken = await getAccessToken();
  const personUrn = await getCredential("linkedin_person_urn");
  if (!personUrn) throw new Error("LinkedIn person URN not found. Reconnect your account.");

  const body = {
    author: `urn:li:person:${personUrn}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const res = await fetch(`${LINKEDIN_API_BASE}/v2/ugcPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401) {
      // Try refresh
      try {
        const newToken = await refreshAccessToken();
        return publishTextPost(text); // retry once
      } catch {
        throw new Error(`LinkedIn auth expired. Reconnect in Settings. (${errText})`);
      }
    }
    throw new Error(`LinkedIn publish failed (${res.status}): ${errText}`);
  }

  const postId = res.headers.get("x-restli-id") || "";
  const postUrl = `https://www.linkedin.com/feed/update/${postId}`;

  return { postId, postUrl };
}

async function registerAndUploadImageBuffer(
  accessToken: string,
  author: string,
  imageBuffer: Buffer
): Promise<string> {
  const registerRes = await fetch(`${LINKEDIN_API_BASE}/v2/assets?action=registerUpload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: author,
        serviceRelationships: [
          {
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent",
          },
        ],
      },
    }),
  });

  if (!registerRes.ok) {
    const errText = await registerRes.text();
    throw new Error(`LinkedIn image register failed (${registerRes.status}): ${errText}`);
  }

  const registerData = (await registerRes.json()) as {
    value: {
      uploadMechanism: {
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
          uploadUrl: string;
        };
      };
      asset: string;
    };
  };

  const uploadUrl =
    registerData.value.uploadMechanism[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ].uploadUrl;
  const asset = registerData.value.asset;

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(imageBuffer),
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`LinkedIn image upload failed (${uploadRes.status}): ${errText}`);
  }

  return asset;
}

/**
 * Publish a text post with one or more images (single image or carousel).
 * Empty buffer list falls back to text-only.
 */
export async function publishPostWithImageBuffers(
  text: string,
  imageBuffers: Buffer[],
  retried401 = false
): Promise<{ postId: string; postUrl: string }> {
  if (imageBuffers.length === 0) {
    return publishTextPost(text);
  }

  const accessToken = await getAccessToken();
  const personUrn = await getCredential("linkedin_person_urn");
  if (!personUrn) throw new Error("LinkedIn person URN not found. Reconnect your account.");

  const author = `urn:li:person:${personUrn}`;

  const media: { status: string; media: string }[] = [];
  for (const buf of imageBuffers) {
    const asset = await registerAndUploadImageBuffer(accessToken, author, buf);
    media.push({ status: "READY", media: asset });
  }

  const body = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "IMAGE",
        media,
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const res = await fetch(`${LINKEDIN_API_BASE}/v2/ugcPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401 && !retried401) {
      try {
        await refreshAccessToken();
        return publishPostWithImageBuffers(text, imageBuffers, true);
      } catch {
        throw new Error(`LinkedIn auth expired. Reconnect in Settings. (${errText})`);
      }
    }
    throw new Error(`LinkedIn publish with image(s) failed (${res.status}): ${errText}`);
  }

  const postId = res.headers.get("x-restli-id") || "";
  const postUrl = `https://www.linkedin.com/feed/update/${postId}`;

  return { postId, postUrl };
}

/** Single local file — same pipeline as {@link publishPostWithImageBuffers}. */
export async function publishImagePost(text: string, imagePath: string): Promise<{
  postId: string;
  postUrl: string;
}> {
  const absolutePath = path.isAbsolute(imagePath) ? imagePath : path.join(process.cwd(), imagePath);
  const imageBuffer = fs.readFileSync(absolutePath);
  return publishPostWithImageBuffers(text, [imageBuffer]);
}

// ── Post a comment ─────────────────────────────────────────────────────────

export async function publishComment(postUrn: string, text: string): Promise<void> {
  const accessToken = await getAccessToken();
  const personUrn = await getCredential("linkedin_person_urn");
  if (!personUrn) return;

  const res = await fetch(`${LINKEDIN_API_BASE}/v2/socialActions/${postUrn}/comments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      actor: `urn:li:person:${personUrn}`,
      message: { text },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LinkedIn comment failed (${res.status}): ${errText}`);
  }
}

// ── Connection status ──────────────────────────────────────────────────────

export async function getConnectionStatus(): Promise<{
  connected: boolean;
  name?: string;
}> {
  const token = await getCredential("linkedin_access_token");
  if (!token) return { connected: false };

  const headers = { Authorization: `Bearer ${token}` };

  // Try OpenID userinfo first (works if app has "Sign In with LinkedIn" product)
  try {
    const res = await fetch(`${LINKEDIN_API_BASE}/v2/userinfo`, { headers });
    if (res.status === 401) return { connected: false };
    if (res.ok) {
      const data = (await res.json()) as { name?: string };
      return { connected: true, name: data.name };
    }
  } catch {
    // continue
  }

  // Try legacy /v2/me (works if profile/r_liteprofile scope is available)
  try {
    const res = await fetch(`${LINKEDIN_API_BASE}/v2/me`, { headers });
    if (res.status === 401) return { connected: false };
    if (res.ok) {
      const data = (await res.json()) as {
        localizedFirstName?: string;
        localizedLastName?: string;
      };
      const name = [data.localizedFirstName, data.localizedLastName]
        .filter(Boolean)
        .join(" ");
      return { connected: true, name: name || undefined };
    }
  } catch {
    // continue
  }

  // Token exists and neither endpoint returned 401 — assume connected for posting
  const urn = await getCredential("linkedin_person_urn").catch(() => null);
  if (urn) return { connected: true };

  return { connected: false };
}
