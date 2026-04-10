import keytar from "keytar";

const SERVICE = "linkdup";

export type CredentialKey =
  | "openrouter"
  | "apify"
  | "linkedin_client_id"
  | "linkedin_client_secret"
  | "linkedin_access_token"
  | "linkedin_refresh_token"
  | "linkedin_person_urn";

export async function getCredential(key: CredentialKey): Promise<string | null> {
  return keytar.getPassword(SERVICE, key);
}

export async function setCredential(key: CredentialKey, value: string): Promise<void> {
  await keytar.setPassword(SERVICE, key, value);
}

export async function deleteCredential(key: CredentialKey): Promise<boolean> {
  return keytar.deletePassword(SERVICE, key);
}

export async function hasCredential(key: CredentialKey): Promise<boolean> {
  const value = await getCredential(key);
  return value !== null && value.length > 0;
}

export async function isOnboarded(): Promise<boolean> {
  return hasCredential("openrouter");
}
