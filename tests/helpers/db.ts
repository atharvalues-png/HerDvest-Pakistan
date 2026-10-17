import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

/**
 * Test database helper. Creates a fresh `<db>_test` database, applies the
 * real migrations, and lets tests act as specific users through the
 * non-privileged herdvest_app role — exactly as the web app does.
 */

function env() {
  const vars: Record<string, string> = {};
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) vars[m[1]] = m[2];
    }
  }
  return { ...vars, ...process.env } as Record<string, string>;
}

const e = env();
const withDb = (url: string, db: string) => {
  const u = new URL(url);
  u.pathname = `/${db}`;
  return u.toString();
};
const baseDb = new URL(e.DATABASE_ADMIN_URL).pathname.slice(1);
export const TEST_DB = `${baseDb}_test`;
export const adminUrl = withDb(e.DATABASE_ADMIN_URL, TEST_DB);
export const appUrl = withDb(e.DATABASE_URL, TEST_DB);

export async function resetTestDatabase() {
  const root = new pg.Client({ connectionString: withDb(e.DATABASE_ADMIN_URL, "postgres") });
  await root.connect();
  await root.query(`drop database if exists ${TEST_DB} with (force)`);
  await root.query(`create database ${TEST_DB}`);
  await root.end();
  execFileSync("node", ["scripts/migrate.mjs"], {
    env: { ...process.env, DATABASE_ADMIN_URL: adminUrl, DATABASE_URL: appUrl },
    stdio: "pipe",
  });
}

export const admin = () => new pg.Pool({ connectionString: adminUrl, max: 2 });
export const app = () => new pg.Pool({ connectionString: appUrl, max: 4 });

/** Run fn as the given user inside a transaction on the app role (RLS applies). */
export async function as<T>(pool: pg.Pool, userId: string | null, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('hv.user_id', $1, true)", [userId ?? ""]);
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (err) {
    await c.query("rollback").catch(() => {});
    throw err;
  } finally {
    c.release();
  }
}

export async function createUser(pool: pg.Pool, role: string, name: string, withEmployee = false) {
  let employeeId: string | null = null;
  if (withEmployee) {
    const r = await pool.query("insert into hv.employees (full_name, job_title) values ($1, $2) returning id", [name, role]);
    employeeId = r.rows[0].id;
  }
  const r = await pool.query(
    "insert into hv.users (email, full_name, password_hash, role_id, employee_id) values ($1, $2, 'test-not-a-hash', $3, $4) returning id",
    [`${name.toLowerCase().replace(/\s+/g, ".")}@test.local`, name, role, employeeId],
  );
  return { id: r.rows[0].id as string, employeeId };
}
