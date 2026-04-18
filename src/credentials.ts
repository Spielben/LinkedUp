const USE_ENV = process.env.USE_ENV_CREDENTIALS === "true";

export type CredentialKey =
  | "openrouter"
  | "apify"
  | "linkedin_client_id"
  | "linkedin_client_secret"
  | "linkedin_access_token"
  | "linkedin_refresh_token"
  | "linkedin_person_urn";

const ENV_MAP: Record<CredentialKey, string> = {
  openrouter: "OPENROUTER_API_KEY",
  apify: "APIFY_API_KEY",
  linkedin_client_id: "LINKEDIN_CLIENT_ID",
  linkedin_client_secret: "LINKEDIN_CLIENT_SECRET",
  linkedin_access_token: "LINKEDIN_ACCESS_TOKEN",
  linkedin_refresh_token: "LINKEDIN_REFRESH_TOKEN",
  linkedin_person_urn: "LINKEDIN_PERSON_URN",
};

const LINKEDIN_TOKEN_KEYS: CredentialKey[] = [
  "linkedin_access_token",
  "linkedin_refresh_token",
  "linkedin_person_urn",
];

function isLinkedinTokenKey(key: CredentialKey): boolean {
  return LINKEDIN_TOKEN_KEYS.includes(key);
}

async function readLinkedinTokensFromDb(): Promise<Record<string, string>> {
  const { getDb } = await import("./db/index.js");
  const db = getDb();
  const row = db.prepare("SELECT linkedin_tokens FROM settings WHERE id = 1").get() as
    | { linkedin_tokens?: string | null }
    | undefined;
  try {
    return JSON.parse(row?.linkedin_tokens || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

async function writeLinkedinTokenToDb(key: CredentialKey, value: string): Promise<void> {
  const { getDb } = await import("./db/index.js");
  const db = getDb();
  const row = db.prepare("SELECT linkedin_tokens FROM settings WHERE id = 1").get() as
    | { linkedin_tokens?: string | null }
    | undefined;
  let tokens: Record<string, string> = {};
  try {
    tokens = JSON.parse(row?.linkedin_tokens || "{}") as Record<string, string>;
  } catch {
    tokens = {};
  }
  tokens[key] = value;
  const payload = JSON.stringify(tokens);
  const info = db.prepare("UPDATE settings SET linkedin_tokens = ? WHERE id = 1").run(payload);
  if (info.changes === 0) {
    db.prepare("INSERT INTO settings (id, linkedin_tokens) VALUES (1, ?)").run(payload);
  }
}

export async function getCredential(key: CredentialKey): Promise<string | null> {
  if (USE_ENV) {
    if (isLinkedinTokenKey(key)) {
      const tokens = await readLinkedinTokensFromDb();
      return tokens[key] ?? null;
    }
    return process.env[ENV_MAP[key]] ?? null;
  }
  const keytar = await import("keytar");
  return keytar.default.getPassword("linkdup", key);
}

export async function setCredential(key: CredentialKey, value: string): Promise<void> {
  if (USE_ENV) {
    if (isLinkedinTokenKey(key)) {
      await writeLinkedinTokenToDb(key, value);
    }
    return;
  }
  const keytar = await import("keytar");
  await keytar.default.setPassword("linkdup", key, value);
}

export async function deleteCredential(key: CredentialKey): Promise<boolean> {
  if (USE_ENV) return false;
  const keytar = await import("keytar");
  return keytar.default.deletePassword("linkdup", key);
}

export async function hasCredential(key: CredentialKey): Promise<boolean> {
  const value = await getCredential(key);
  return value !== null && value.length > 0;
}

export async function isOnboarded(): Promise<boolean> {
  return hasCredential("openrouter");
}
