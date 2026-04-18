import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { setCredential, isOnboarded } from "./credentials.js";
import { getDb } from "./db/index.js";

function hiddenInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    stdout.write(prompt);
    const rl = readline.createInterface({ input: stdin, output: stdout });

    // Mute output to hide the key as user types
    const origWrite = stdout.write.bind(stdout);
    stdout.write = ((chunk: string | Uint8Array) => {
      // Suppress echoing of input characters
      if (typeof chunk === "string" && chunk !== prompt && !chunk.includes("\n")) {
        return true;
      }
      return origWrite(chunk);
    }) as typeof stdout.write;

    rl.question("").then((answer) => {
      stdout.write = origWrite;
      stdout.write("\n");
      rl.close();
      resolve(answer.trim());
    });
  });
}

function visibleInput(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  return rl.question(prompt).then((answer) => {
    rl.close();
    return answer.trim();
  });
}

export async function runOnboarding(): Promise<boolean> {
  if (await isOnboarded()) {
    return true;
  }

  if (process.env.USE_ENV_CREDENTIALS === "true") {
    console.error(`
  ❌ Headless / Docker: OPENROUTER_API_KEY is missing or empty.
     Add it to .env.production on the server and ensure compose lists env_file for linkdup.
`);
    return false;
  }

  console.log(`
  🔗 LINK'DUP — LinkedIn Content Generator

  First time setup:
`);

  // Step 1: OpenRouter API key (required)
  console.log("  1/3 — OpenRouter API key (required)");
  console.log("        Get yours at https://openrouter.ai/keys");
  console.log("        💡 We recommend adding $5 in credits to start (~200 posts)");
  const openrouterKey = await hiddenInput("        → Paste your key (hidden): ");

  if (!openrouterKey || openrouterKey.length < 10) {
    console.log("\n  ❌ OpenRouter API key is required. Exiting setup.");
    return false;
  }

  await setCredential("openrouter", openrouterKey);
  console.log("        ✅ Stored securely in your system keychain\n");

  // Step 2: Apify API key (optional)
  console.log("  2/3 — Apify API key (optional, for LinkedIn profile scraping)");
  console.log("        Get one free at https://apify.com");
  const apifyKey = await hiddenInput("        → Paste your key or press Enter to skip: ");

  if (apifyKey && apifyKey.length > 5) {
    await setCredential("apify", apifyKey);
    console.log("        ✅ Stored securely\n");
  } else {
    console.log("        ⏭️  Skipped (add later: security add-generic-password -s linkdup -a apify -w YOUR_KEY)\n");
  }

  // Step 3: LinkedIn URL
  console.log("  3/3 — Your LinkedIn profile URL");
  const linkedinUrl = await visibleInput("        → ");

  if (linkedinUrl) {
    const db = getDb();
    const existing = db.prepare("SELECT * FROM settings WHERE id = 1").get();
    if (existing) {
      db.prepare("UPDATE settings SET linkedin_url = ? WHERE id = 1").run(linkedinUrl);
    } else {
      db.prepare("INSERT INTO settings (id, linkedin_url) VALUES (1, ?)").run(linkedinUrl);
    }
    console.log("        ✅ Saved\n");
  }

  console.log("  Setup complete!\n");
  return true;
}
