import { getCredential, setCredential } from "../credentials.js";
import fs from "node:fs";
import path from "node:path";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_API_BASE = "https://api.linkedin.com";

const REDIRECT_URI = "http://localhost:3000/api/linkedin/callback";
const SCOPES = "openid profile w_member_social";

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

export async function buildAuthUrl(): Promise<string> {
  const clientId = await getCredential("linkedin_client_id");
  if (!clientId) throw new Error("LinkedIn Client ID not configured");

  const state = Math.random().toString(36).slice(2);
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

async function fetchPersonUrn(accessToken: string): Promise<string> {
  const res = await fetch(`${LINKEDIN_API_BASE}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LinkedIn userinfo failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { sub: string; name?: string };
  return data.sub;
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

export async function publishImagePost(text: string, imagePath: string): Promise<{
  postId: string;
  postUrl: string;
}> {
  const accessToken = await getAccessToken();
  const personUrn = await getCredential("linkedin_person_urn");
  if (!personUrn) throw new Error("LinkedIn person URN not found. Reconnect your account.");

  const author = `urn:li:person:${personUrn}`;

  // Step 1: Register the image upload
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

  // Step 2: Upload the image binary
  const absolutePath = path.isAbsolute(imagePath)
    ? imagePath
    : path.join(process.cwd(), imagePath);
  const imageBuffer = fs.readFileSync(absolutePath);

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
    },
    body: imageBuffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`LinkedIn image upload failed (${uploadRes.status}): ${errText}`);
  }

  // Step 3: Create the post with the image
  const body = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "IMAGE",
        media: [
          {
            status: "READY",
            media: asset,
          },
        ],
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
    throw new Error(`LinkedIn publish with image failed (${res.status}): ${errText}`);
  }

  const postId = res.headers.get("x-restli-id") || "";
  const postUrl = `https://www.linkedin.com/feed/update/${postId}`;

  return { postId, postUrl };
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

  try {
    const res = await fetch(`${LINKEDIN_API_BASE}/v2/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return { connected: false };

    const data = (await res.json()) as { name?: string; sub?: string };
    return { connected: true, name: data.name };
  } catch {
    return { connected: false };
  }
}
