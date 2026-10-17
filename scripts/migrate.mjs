#!/usr/bin/env node
/**
 * Applies db/migrations/*.sql in order, once each.
 *
 *   DATABASE_ADMIN_URL  connection with rights to create roles and own the schema
 *   DATABASE_URL        the application's connection (role herdvest_app); its
 *                       password is used when creating that role
 *
 * Usage: node scripts/migrate.mjs            (reads .env.local if present)
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import pg from "pg";

loadEnvFile(".env.local");

const adminUrl = process.env.DATABASE_ADMIN_URL;
const appUrl = process.env.DATABASE_URL;
if (!adminUrl || !appUrl) {
  console.error("DATABASE_ADMIN_URL and DATABASE_URL must be set (see .env.example).");
  process.exit(1);
}

const appUser = decodeURIComponent(new URL(appUrl).username);
const appPassword = decodeURIComponent(new URL(appUrl).password);
if (appUser !== "herdvest_app") {
  console.error(`DATABASE_URL must connect as role "herdvest_app" (got "${appUser}").`);
  process.exit(1);
}
if (!appPassword || appPassword.length < 16) {
  console.error("Use a strong password (16+ characters) for herdvest_app in DATABASE_URL.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: adminUrl });
await client.connect();

try {
  // Application role: can log in, owns nothing, cannot bypass RLS.
  const { rowCount } = await client.query("select 1 from pg_roles where rolname = 'herdvest_app'");
  const pw = appPassword.replace(/'/g, "''");
  if (rowCount === 0) {
    await client.query(`create role herdvest_app login nosuperuser nocreatedb nocreaterole noinherit nobypassrls password '${pw}'`);
    console.log("created role herdvest_app");
  } else {
    await client.query(`alter role herdvest_app login nosuperuser nobypassrls password '${pw}'`);
  }

  await client.query("create schema if not exists hv_meta");
  await client.query(
    "create table if not exists hv_meta.schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );

  const dir = path.resolve("db/migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const applied = new Set((await client.query("select name from hv_meta.schema_migrations")).rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(path.join(dir, file), "utf8");
    process.stdout.write(`applying ${file} … `);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into hv_meta.schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log("ok");
    } catch (err) {
      await client.query("rollback");
      console.log("FAILED");
      throw err;
    }
  }
  console.log("migrations up to date");
} finally {
  await client.end();
}

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
