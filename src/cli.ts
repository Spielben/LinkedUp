import { runOnboarding } from "./onboarding.js";
import { createServer } from "./server.js";

async function main() {
  // Skip onboarding in dev mode
  if (!process.env.DEV) {
    const onboarded = await runOnboarding();
    if (!onboarded) {
      process.exit(1);
    }
  }

  const port = parseInt(process.env.PORT || "3000", 10);
  createServer(port);

  // Open browser in production (not during dev / not on headless VPS with env credentials)
  if (!process.env.DEV && process.env.USE_ENV_CREDENTIALS !== "true") {
    const { default: open } = await import("open");
    await open(`http://localhost:${port}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
