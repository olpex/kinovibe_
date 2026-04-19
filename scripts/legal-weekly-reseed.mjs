#!/usr/bin/env node

import { spawn } from "node:child_process";

function utcTimestampForMigration() {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  const minute = String(now.getUTCMinutes()).padStart(2, "0");
  const second = String(now.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hour}${minute}${second}`;
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${command} ${args.join(" ")}), exit code ${code}`));
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");

  const migrationTs = utcTimestampForMigration();
  const migrationName = `${migrationTs}_reseed_legal_catalog_archive_org.sql`;

  const env = {
    ...process.env,
    LEGAL_SEED_MIGRATION_NAME: process.env.LEGAL_SEED_MIGRATION_NAME ?? migrationName,
    LEGAL_SEED_TARGET: process.env.LEGAL_SEED_TARGET ?? "55",
    LEGAL_SEED_PROVIDER_ALLOWLIST: process.env.LEGAL_SEED_PROVIDER_ALLOWLIST ?? "internet_archive",
    LEGAL_SEED_MAX_DUPLICATES_PER_BASE_TITLE:
      process.env.LEGAL_SEED_MAX_DUPLICATES_PER_BASE_TITLE ?? "2"
  };

  process.stdout.write(
    [
      "Starting legal weekly reseed...",
      `- migration: ${env.LEGAL_SEED_MIGRATION_NAME}`,
      `- target: ${env.LEGAL_SEED_TARGET}`,
      `- allowlist: ${env.LEGAL_SEED_PROVIDER_ALLOWLIST}`,
      `- max duplicates per base title: ${env.LEGAL_SEED_MAX_DUPLICATES_PER_BASE_TITLE}`,
      `- apply: ${apply ? "yes" : "no"}`
    ].join("\n") + "\n"
  );

  await run("node", ["scripts/generate-legal-seed-from-archive.mjs"], env);

  if (apply) {
    await run("npx", ["--yes", "supabase@latest", "db", "push"], env);
  } else {
    process.stdout.write(
      "Generation completed. To apply migration now, run: npm run legal:seed:weekly -- --apply\n"
    );
  }
}

main().catch((error) => {
  process.stderr.write(`ERROR: ${error?.message ?? String(error)}\n`);
  process.exit(1);
});

