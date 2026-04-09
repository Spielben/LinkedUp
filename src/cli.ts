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

  // Open browser in production (not during dev)
  if (!process.env.DEV) {
    const { default: open } = await import("open");
    await open(`http://localhost:${port}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
