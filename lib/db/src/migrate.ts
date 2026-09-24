import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, "../migrations");

const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("NEON_DATABASE_URL or DATABASE_URL must be set");

const pool = new Pool({ connectionString: url });

await pool.query(`
  CREATE TABLE IF NOT EXISTS _schema_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

const { rows: applied } = await pool.query<{ name: string }>(
  "SELECT name FROM _schema_migrations"
);
const appliedNames = new Set(applied.map((r) => r.name));

if (!fs.existsSync(migrationsDir)) {
  console.log("No migrations directory found, nothing to apply.");
  await pool.end();
  process.exit(0);
}

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let failed = false;

for (const file of files) {
  if (appliedNames.has(file)) {
    console.log(`⏭  ${file}: already applied`);
    continue;
  }

  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  console.log(`▶  Applying ${file}…`);

  try {
    await pool.query(sql);
    await pool.query("INSERT INTO _schema_migrations (name) VALUES ($1)", [file]);
    console.log(`✅  ${file}: done`);
  } catch (err: any) {
    console.error(`❌  ${file}: failed — ${err.message}`);
    failed = true;
    break;
  }
}

await pool.end();

if (failed) {
  process.exit(1);
}

console.log("✅  All migrations up to date");
