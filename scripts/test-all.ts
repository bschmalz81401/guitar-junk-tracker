/**
 * Run the full local automated suite used by `npm test` and CI.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const scripts = [
  "test-privacy.ts",
  "test-categories.ts",
  "test-item-duplicate.ts",
  "test-csv-import.ts",
  "test-rate-limit.ts",
  "test-password-reset.ts",
  "test-safe-fetch.ts",
  "test-photo-cleanup.ts",
  "test-session.ts",
  "test-upload.ts",
  "test-parser.ts",
];
const root = join(__dirname, "..");

let failed = 0;
for (const script of scripts) {
  console.log(`\n=== ${script} ===`);
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", join(__dirname, script)],
    { cwd: root, stdio: "inherit", env: process.env }
  );
  if (result.status !== 0) failed += 1;
}

if (failed > 0) {
  console.error(`\n${failed} suite(s) failed.`);
  process.exit(1);
}
console.log("\nAll test suites passed.");
