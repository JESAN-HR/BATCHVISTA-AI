import { resolve, join } from "node:path";
import { existsSync, renameSync } from "node:fs";
if (process.argv[2] !== "--confirm") {
  console.error(
    "Stop the server, then run npm run reset -- --confirm. Existing local data will be moved to a timestamped backup.",
  );
  process.exit(1);
}
const target = resolve("data");
if (target !== join(process.cwd(), "data"))
  throw new Error("Unexpected data path");
if (process.env.BATCHVISTA_DATA_DIR)
  throw new Error("Custom data directory set. Back it up and reset manually.");
if (existsSync(target)) {
  const backup = resolve(`data-backup-${Date.now()}`);
  renameSync(target, backup);
  console.log(
    `Data preserved at ${backup}. Restart the app to create a fresh workspace.`,
  );
} else console.log("No local data to reset.");
