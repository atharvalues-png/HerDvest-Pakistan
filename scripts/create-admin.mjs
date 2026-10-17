#!/usr/bin/env node
/**
 * Creates (or resets) the first Super Admin account.
 *
 *   node scripts/create-admin.mjs --email owner@example.com --name "Owner Name"
 *
 * The password is read from the HERDVEST_ADMIN_PASSWORD environment variable or
 * prompted for interactively; it is never passed on the command line. The user
 * must change it on first sign-in.
 */
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, all) => (v.startsWith("--") ? [...acc, [v.slice(2), all[i + 1]]] : acc), []),
);
const email = args.email?.trim().toLowerCase();
const name = args.name?.trim();
if (!email || !name) {
  console.error('Usage: node scripts/create-admin.mjs --email you@company.com --name "Full Name"');
  process.exit(1);
}

let password = process.env.HERDVEST_ADMIN_PASSWORD;
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question("Temporary password (12+ characters): ");
  rl.close();
}
if (!password || password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

// Must match src/lib/auth/password.ts
const N = 32768, r = 8, p = 1;
const salt = randomBytes(16);
const hash = scryptSync(password.normalize("NFKC"), salt, 64, { N, r, p, maxmem: 128 * N * r * 2 });
const encoded = `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;

const client = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
await client.connect();
try {
  await client.query(
    `insert into hv.users (email, full_name, password_hash, role_id, must_change_password)
     values ($1, $2, $3, 'super_admin', true)
     on conflict (email) do update set password_hash = excluded.password_hash, role_id = 'super_admin',
       is_active = true, must_change_password = true, failed_logins = 0, locked_until = null`,
    [email, name, encoded],
  );
  console.log(`Super Admin ready: ${email} (password change required at first sign-in)`);
} finally {
  await client.end();
}
